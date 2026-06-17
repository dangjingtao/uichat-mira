const settingsPending = {
  settings: {
    about: {
      linkCopied: "Link copied",
      linkCopyFailed: "Failed to copy link",
      miniTitle: "About",
      versionHistory: "Version History",
      authorDocs: "Author & Documentation",
      gitInfo: "Git Repository Info",
      currentBranch: "Current Branch",
      changelogTitle: "Changelog",
      changelogCollapse: "Collapse",
      changelogExpand: "View full text",
      fallback: {
        changelog: [
          "Refactored About page into software info & maintenance record layout",
          "Clearly distinguish Electron / Tauri runtime versions",
          "Retain version history, author & documentation entries",
        ],
        versionHistory: {
          "0_1_0": "Desktop chat, model config, knowledge base & health check main flows formed",
          "0_0_9": "Completed settings page structure, unified desktop runtime integration",
          "0_0_8": "Initial RAG testing workbench & conversation thread capabilities",
        },
        links: {
          author: "Author",
          repository: "Repository",
          homepage: "Homepage",
          docs: "Component Docs",
        },
      },
    },
    tools: {
      miniTitle: "Tools",
      title: "Tools",
      description: "Built-in agent tools loaded dynamically from the tools/ and extendTools/ directories.",
      loading: "Loading...",
      empty: "No tools loaded.",
      loadFailed: "Failed to load tools",
    },
    knowledgeBase: {
      add: {
        step1: "Select Data Source",
        step2: "Text Chunking & Cleaning",
        step3: "Processing & Complete",
        uploadTitle: "Upload Text File",
        uploadDesc: "Select the file to import into the knowledge base.",
        helperText:
          "Supports MARKDOWN and TXT. Only 1 file at a time, max 100 MB per file.",
        helperTextNoEmbedding:
          "Please configure the default Embedding model in Model Settings first, then upload knowledge base files.",
        noEmbeddingWarning:
          "Default embedding model not connected. Unable to upload knowledge base files for now.",
        embeddingModel: "Embedding Model",
        llmModel: "LLM Model",
        rerankModel: "Rerank Model",
        oneFileOnly: "Only 1 file can be uploaded at a time",
        fileTooLarge: "Single file size cannot exceed 100 MB",
        removeFirst:
          "Only 1 file can be uploaded at a time. Please remove the current file first.",
        fileAdded: "File added to upload list",
        fileRemoved: "File removed",
        selectFileToPreview: "Please select a file to preview first",
        previewFailed: "Preview failed",
        previewSuccess: "Generated {{count}} text chunk previews",
        resampleSuccess: "Resampled batch",
        needConfig:
          "Please complete the default LLM and Embedding model configuration first",
        indexTimeout:
          "Knowledge document indexing timed out. Please check the processing status in the knowledge base list later.",
        processFailed: "Knowledge document processing failed",
        uploadSuccess: "Knowledge document has been added to the library",
        connected: "Connected",
        notConnected: "Not connected",
        configured: "Configured",
        requiredConfig: "Required",
        notConfigured: "Not configured",
        noModelSelected: "No model selected yet",
        noProvider: "No provider selected",
        defaultModel: "Default model",
        chunkSettings: "Chunking Settings",
        general: "General",
        generalDesc:
          "General text chunking mode. Retrieval and recall chunks are the same.",
        splitterType: "Splitter Type",
        chunkSize: "Max Length",
        chunkOverlap: "Overlap Length",
        lengthMetric: "Length Metric",
        characters: "Characters",
        utf8Bytes: "UTF-8 Bytes",
        keepSeparator: "Keep Separator",
        separator: "Separator",
        presetLanguage: "Preset Language",
        noPreset: "No preset",
        customSeparators: "Custom separators",
        encodingName: "encodingName",
        allowedSpecial: "allowedSpecial",
        disallowedSpecial: "disallowedSpecial",
        preprocessingRules: "Text Preprocessing Rules",
        replaceWhitespace: "Replace consecutive whitespace",
        removeUrls: "Remove URLs and emails",
        useQaSplit: "Use Q&A splitting",
        tip: "Tip: For Markdown docs, try `MarkdownTextSplitter` first; for general TXT, start with `RecursiveCharacterTextSplitter + markdown preset` or custom separators.",
        preview: "Preview chunks",
        previewing: "Previewing...",
        resample: "Resample batch",
        reset: "Reset",
        modelConfig: "Model Configuration",
        llmTitle: "LLM Model",
        llmDesc:
          "Used for answer generation. Default LLM must be configured at this step.",
        embeddingTitle: "Embedding Model",
        embeddingDesc:
          "Used for vectorization and semantic retrieval. Default Embedding must be configured at this step.",
        rerankTitle: "ReRank Model",
        rerankDesc:
          "Used for result reranking. Currently optional and does not affect proceeding to the next step.",
        previewTitle: "Preview",
        noFileSelected: "No file selected",
        sampleCount: "{{current}}/{{total}} sample chunks",
        previewCount: "{{count}} preview chunks",
        previewPlaceholder:
          "Click 'Preview chunks' on the left to see knowledge text chunking results here.",
        totalChunks: "Total chunks",
        avgLength: "Average length",
        minLength: "Min chunk",
        maxLength: "Max chunk",
        prevStep: "Previous step",
        nextStep: "Next step",
        processComplete: "Knowledge document processing complete",
        processCompleteDesc:
          "{{fileName}} has been uploaded, chunked, and added to the library. Knowledge fragments can now be viewed in the knowledge base list and used for subsequent retrieval and Q&A.",
        fileCount: "Files",
        textChunks: "Text chunks",
        backToManage: "Back to Knowledge Base Management",
        processFailedTitle: "Knowledge document processing failed",
        backToPrev: "Back to previous step",
        documentUploaded: "Document uploaded",
        uploadingDesc:
          "Document is being uploaded to the knowledge base and chunked. The interface will automatically switch to a success prompt after processing is complete.",
        processing: "Processing document...",
        knowledgeDoc: "Knowledge document",
        filesCompleted: "Completed {{completed}}/{{total}} files",
        chunkMode: "Chunking mode",
        maxChunkSize: "Max chunk size",
        preprocessingLabel: "Text preprocessing rules",
        ruleReplaceWhitespace: "Replace consecutive spaces, newlines, and tabs",
        ruleRemoveUrls: "Remove URLs and email addresses",
        ruleQaSplit: "Enable Q&A splitting",
        noExtraRules: "No extra rules enabled",
        whatsNext: "What's next",
        whatsNextDesc:
          "After processing, you can return to the knowledge base management page to check document status, or proceed to the chat flow to verify retrieval hit fragments.",
        backToKnowledgeBase: "Back to Knowledge Base",
        localUpload: "Local Upload",
        hints: {
          splitterType:
            "Choose a LangChain text splitter. Different splitters affect chunk structure, boundaries, and semantic preservation.",
          chunkSize:
            "Maximum length allowed per chunk. Larger values provide more complete context; smaller values enable finer recall.",
          chunkOverlap:
            "Overlap length retained between adjacent chunks to reduce the risk of information being cut off.",
          keepSeparator:
            "Keeping separators is usually better for preserving Markdown, code, or paragraph boundaries.",
          separator: "Separator used by Character splitter, e.g. \\n\\n.",
          separators:
            "Separator priority list for Recursive splitter, separated by commas or newlines.",
          presetLanguage:
            "Recursive splitter can directly apply language preset separator rules.",
          encodingName: "Encoder name used by Token splitter.",
          allowedSpecial:
            "Special tokens allowed to pass through. Multiple values separated by commas.",
          disallowedSpecial: "Disallowed special tokens. Default is all.",
          lengthMetric: "Length unit controlling chunkSize / overlap.",
          replaceWhitespace:
            "Clean up extra spaces, tabs, and consecutive blank lines. Suitable for most md/txt documents.",
          removeUrls:
            "Suitable for knowledge body scenarios; if links themselves are meaningful, it is recommended to turn this off.",
          useQaSplit:
            "Prioritize recognizing Q:/A:, 问:/答: structures before length splitting. Suitable for FAQ documents.",
        },
      },
    },
  },
} as const;

export default settingsPending;
