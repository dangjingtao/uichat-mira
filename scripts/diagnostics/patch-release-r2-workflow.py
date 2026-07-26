from __future__ import annotations

import sys
from pathlib import Path

if len(sys.argv) != 2:
    raise SystemExit("usage: patch-release-r2-workflow.py <workflow-path>")

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

old_trigger = """  push:
    branches:
      - feature/release-factory-v2
"""
new_trigger = """  push:
    branches:
      - feature/release-factory-v2
      - prod
    tags:
      - 'v*'
"""
if old_trigger not in text and new_trigger not in text:
    raise SystemExit("Release trigger anchor not found")
text = text.replace(old_trigger, new_trigger, 1)

old_secret = """      HF_TOKEN:
        required: false
"""
new_secret = """      HF_TOKEN:
        required: false
      R2_ACCESS_KEY_ID:
        required: false
      R2_SECRET_ACCESS_KEY:
        required: false
      R2_ACCOUNT_ID:
        required: false
      R2_BUCKET:
        required: false
      R2_PUBLIC_BASE_URL:
        required: false
"""
if "R2_ACCESS_KEY_ID:" not in text:
    if old_secret not in text:
        raise SystemExit("Workflow-call secret anchor not found")
    text = text.replace(old_secret, new_secret, 1)

publish_block = r"""
  publish-release-assets:
    name: Publish GitHub Release and Cloudflare R2
    needs:
      - package-electron-from-payload
      - package-tauri-from-payload
    if: startsWith(github.ref, 'refs/tags/v') || github.ref == 'refs/heads/prod'
    runs-on: ubuntu-latest
    timeout-minutes: 25
    permissions:
      contents: write
    steps:
      - name: Checkout release metadata
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Resolve and validate release tag
        id: release_meta
        shell: bash
        run: |
          package_version=$(node -p "require('./package.json').version")
          expected_tag="v${package_version}"

          if [[ "${GITHUB_REF}" == refs/tags/v* ]]; then
            tag="${GITHUB_REF_NAME}"
            if [ "$tag" != "$expected_tag" ]; then
              echo "Tag ${tag} does not match package.json version ${package_version}." >&2
              exit 1
            fi
          else
            tag="$expected_tag"
            if git rev-parse -q --verify "refs/tags/${tag}" >/dev/null; then
              tag_sha=$(git rev-list -n 1 "$tag")
              if [ "$tag_sha" != "$GITHUB_SHA" ]; then
                echo "Release tag ${tag} already points to ${tag_sha}, expected ${GITHUB_SHA}. Bump package.json or fix the tag explicitly." >&2
                exit 1
              fi
              echo "Release tag ${tag} already exists on this commit; continuing retry."
            fi
          fi

          echo "tag=${tag}" >> "$GITHUB_OUTPUT"

      - name: Create release tag if missing
        if: github.ref == 'refs/heads/prod'
        env:
          RELEASE_TAG: ${{ steps.release_meta.outputs.tag }}
        shell: bash
        run: |
          if git rev-parse -q --verify "refs/tags/${RELEASE_TAG}" >/dev/null; then
            echo "Tag ${RELEASE_TAG} already exists on this commit; reusing it."
            exit 0
          fi
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git tag "$RELEASE_TAG" "$GITHUB_SHA"
          git push origin "refs/tags/${RELEASE_TAG}"

      - name: Download Electron package
        uses: actions/download-artifact@v4
        with:
          name: release-factory-electron-${{ github.sha }}
          path: release-assets/electron

      - name: Download Tauri package
        uses: actions/download-artifact@v4
        with:
          name: release-factory-tauri-${{ github.sha }}
          path: release-assets/tauri

      - name: Flatten release assets
        shell: bash
        run: |
          mkdir -p dist
          find release-assets -type f \( -name '*.exe' -o -name '*.blockmap' -o -name '*.msi' \) -print0 |
            while IFS= read -r -d '' file; do
              relative_path="${file#release-assets/}"
              safe_name=$(printf '%s' "$relative_path" | tr '/\\ ' '___')
              cp "$file" "dist/${safe_name}"
            done
          test -n "$(find dist -maxdepth 1 -type f -print -quit)"
          ls -lah dist/

      - name: Create or update GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ steps.release_meta.outputs.tag }}
          files: dist/*
          generate_release_notes: true

      - name: Validate R2 secrets
        env:
          R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
          R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
          R2_ACCOUNT_ID: ${{ secrets.R2_ACCOUNT_ID }}
          R2_BUCKET: ${{ secrets.R2_BUCKET }}
          R2_PUBLIC_BASE_URL: ${{ secrets.R2_PUBLIC_BASE_URL }}
        shell: bash
        run: |
          missing=0
          for name in R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_ACCOUNT_ID R2_BUCKET R2_PUBLIC_BASE_URL; do
            if [ -z "${!name:-}" ]; then
              echo "::error::Missing required release secret: ${name}"
              missing=1
            fi
          done
          [ "$missing" -eq 0 ]

      - name: Upload release assets to Cloudflare R2
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
          AWS_RETRY_MODE: standard
          AWS_MAX_ATTEMPTS: 5
          R2_ACCOUNT_ID: ${{ secrets.R2_ACCOUNT_ID }}
          R2_BUCKET: ${{ secrets.R2_BUCKET }}
          R2_PUBLIC_BASE_URL: ${{ secrets.R2_PUBLIC_BASE_URL }}
        shell: bash
        run: |
          endpoint="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
          latest_prefix="mira/latest"
          legacy_previous_prefix="mira/previous"

          aws s3 rm "s3://${R2_BUCKET}/${legacy_previous_prefix}/" \
            --recursive \
            --endpoint-url "$endpoint" \
            --only-show-errors || true

          for attempt in 1 2 3; do
            if aws s3 sync dist/ "s3://${R2_BUCKET}/${latest_prefix}/" \
              --delete \
              --endpoint-url "$endpoint" \
              --only-show-errors; then
              break
            fi

            if [ "$attempt" -eq 3 ]; then
              echo "R2 upload failed after ${attempt} attempts." >&2
              exit 1
            fi

            sleep $((attempt * 10))
          done

          public_base="${R2_PUBLIC_BASE_URL%/}"
          {
            echo "### Cloudflare R2"
            echo "Uploaded current release assets to: ${public_base}/${latest_prefix}/"
            echo "Retention: latest release only"
          } >> "$GITHUB_STEP_SUMMARY"

"""

if "  publish-release-assets:" not in text:
    anchor = "  release-readiness:\n"
    if anchor not in text:
        raise SystemExit("Readiness job anchor not found")
    text = text.replace(anchor, publish_block + anchor, 1)

readiness_pos = text.index("  release-readiness:")
prefix, readiness = text[:readiness_pos], text[readiness_pos:]

old_needs = """      - package-electron-from-payload
      - package-tauri-from-payload
"""
new_needs = """      - package-electron-from-payload
      - package-tauri-from-payload
      - publish-release-assets
"""
if "      - publish-release-assets\n" not in readiness:
    if old_needs not in readiness:
        raise SystemExit("Readiness needs anchor not found")
    readiness = readiness.replace(old_needs, new_needs, 1)

old_env = """          TAURI_RESULT: ${{ needs.package-tauri-from-payload.result }}
"""
new_env = """          TAURI_RESULT: ${{ needs.package-tauri-from-payload.result }}
          PUBLISH_RESULT: ${{ needs.publish-release-assets.result }}
          PUBLISH_REQUIRED: ${{ startsWith(github.ref, 'refs/tags/v') || github.ref == 'refs/heads/prod' }}
"""
if "PUBLISH_RESULT:" not in readiness:
    if old_env not in readiness:
        raise SystemExit("Readiness env anchor not found")
    readiness = readiness.replace(old_env, new_env, 1)

old_loop = '          for result in "$VALIDATION_RESULT" "$PAYLOAD_RESULT" "$ELECTRON_RESULT" "$TAURI_RESULT"; do\n'
first = readiness.find(old_loop)
if first < 0:
    raise SystemExit("Readiness result loop anchor not found")
loop_end_marker = "          done\n\n"
loop_end = readiness.find(loop_end_marker, first)
if loop_end < 0:
    raise SystemExit("Readiness result loop end not found")
loop_end += len(loop_end_marker)
replacement = """          for result in "$VALIDATION_RESULT" "$PAYLOAD_RESULT" "$ELECTRON_RESULT" "$TAURI_RESULT"; do
            if [[ "$result" != 'success' ]]; then
              state='failure'
              description='Release Factory V2 is not release-ready'
              break
            fi
          done
          if [[ "$PUBLISH_REQUIRED" == 'true' && "$PUBLISH_RESULT" != 'success' ]]; then
            state='failure'
            description='Release publishing to GitHub and R2 failed'
          fi

"""
readiness = readiness[:first] + replacement + readiness[loop_end:]

old_summary = """            echo "- Tauri: ${TAURI_RESULT}"
            echo '- Tests: fresh for this commit'
"""
new_summary = """            echo "- Tauri: ${TAURI_RESULT}"
            echo "- GitHub Release + R2: ${PUBLISH_RESULT} (required=${PUBLISH_REQUIRED})"
            echo '- Tests: fresh for this commit'
"""
if "GitHub Release + R2:" not in readiness:
    if old_summary not in readiness:
        raise SystemExit("Readiness summary anchor not found")
    readiness = readiness.replace(old_summary, new_summary, 1)

last = readiness.rfind(old_loop)
if last < 0:
    raise SystemExit("Final readiness enforcement loop not found")
final_end = readiness.find("          done\n", last)
if final_end < 0:
    raise SystemExit("Final readiness enforcement loop end not found")
final_end += len("          done\n")
final_replacement = """          for result in "$VALIDATION_RESULT" "$PAYLOAD_RESULT" "$ELECTRON_RESULT" "$TAURI_RESULT"; do
            [[ "$result" == 'success' ]] || exit 1
          done
          if [[ "$PUBLISH_REQUIRED" == 'true' ]]; then
            [[ "$PUBLISH_RESULT" == 'success' ]] || exit 1
          fi
"""
readiness = readiness[:last] + final_replacement + readiness[final_end:]

path.write_text(prefix + readiness, encoding="utf-8")
print(f"patched {path}")
