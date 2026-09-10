# Mira Desktop 分支规范

本仓库遵循 Mira Organization 的统一环境模型。组织级规范以 `uichat-mira/.github` 为准；本文件只记录 Desktop 的仓库级落地方式。

## 分支职责

| 分支 | 用途 | 允许进入方式 |
| --- | --- | --- |
| `prod` | 生产分支 | `test` 或紧急 `hotfix/*` 通过 Pull Request 合入 |
| `test` | 测试 / 验收分支 | `dev` 或紧急 `hotfix/*` 通过 Pull Request 合入 |
| `dev` | 日常集成分支 | 工作分支通过 Pull Request 合入 |
| `feat/*` | 新功能开发，从 `dev` 创建 | 完成后 Pull Request 到 `dev` |
| `fix/*` | 普通缺陷修复，从 `dev` 创建 | 完成后 Pull Request 到 `dev` |
| `hotfix/*` | 生产紧急修复，从 `prod` 创建 | 可直接 Pull Request 到 `prod`，随后回灌 `test` / `dev` |

标准流转：

```text
feat/* → dev → test → prod
```

历史 `feature/*` 分支仍兼容，不要求为了命名规范批量重命名；新功能默认使用 `feat/*`。

## Pull Request

- 普通功能不得跳过 `dev` / `test` 直接进入 `prod`。
- PR 应说明目标、影响范围、验证结果和风险。
- `dev → test` 是一次明确的测试候选提升。
- `test → prod` 必须说明发布内容、风险和回滚方式。
- `hotfix/*` 只用于确实需要绕过正常提升节奏的生产紧急修复。

## 构建与发布语义

```text
PR → dev/test/prod  → 轻量检查

dev push  → Desktop 分支包 → Actions artifacts
test push → Desktop 分支包 → Actions artifacts
prod push → Desktop 分支包 → Actions artifacts + R2 mira/latest/

v* tag → Release Factory V2 → GitHub Release + R2 mira/latest/
```

`prod` 发布和 `v*` tag 发布是两个独立入口；`prod` 不隐式创建版本标签。

## 默认分支

当前 GitHub default branch 为 `prod`。

默认分支只影响仓库打开、默认 PR base、clone 后默认 checkout 等 GitHub 使用体验，**不定义环境语义**。环境语义始终由 `dev / test / prod` 及对应 workflow 决定。

`main` 为历史/中性分支，不承担环境或发布职责；除非另有明确治理决定，不因卫生清理而删除。

## 保护规则

生产分支建议由 GitHub Rulesets / Branch protection 保证：

- 禁止 force push
- 禁止删除
- 通过 Pull Request 合入
- 必要 CI / 对话解决后再合并

具体规则以 GitHub 当前有效 ruleset 为事实来源，不以本文件代替实际配置。
