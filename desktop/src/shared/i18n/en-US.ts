const enUS = {
  common: {
    actions: {
      cancel: "Cancel",
      reset: "Reset",
      backToChat: "Back to Chat",
      close: "Close",
      view: "View",
      download: "Download",
      delete: "Delete",
      refresh: "Refresh",
      start: "Start",
      generate: "Generate",
    },
  },
  settings: {
    navigation: {
      general: "General",
      model: "Models",
      knowledgeBase: "Knowledge Base",
      evaluationWorkbench: "Evaluation Workbench",
      evaluationCenter: "Evaluation Center",
      tools: "Tools",
      about: "About",
    },
    knowledgeBase: {
      page: {
        miniTitle: "Knowledge Base",
        title: "Default Knowledge Base",
        descriptionFallback:
          "This page shows every document in the current knowledge base. Double-click any row to open details, or choose Add File to start the step-by-step upload flow.",
      },
      actions: {
        metadata: "Metadata",
        addFile: "Add File",
        rebuildIndex: "Rebuild Index",
        confirmRebuild: "Confirm Rebuild",
        deleteDocument: "Delete Document",
        confirmDelete: "Confirm Delete",
        backToKnowledgeBase: "Back to Knowledge Base",
        testRetrieval: "Test Retrieval Now",
      },
      messages: {
        rebuildPending:
          "Rebuild index is coming soon. Current document: {{name}}",
        deleted: "Deleted {{name}}",
        deleteFailed: "Failed to delete document",
        uploadRequiresEmbedding:
          "Please connect a default embedding model before uploading knowledge base files",
        loadingDocuments: "Loading knowledge base documents...",
        loadingDetail: "Loading document details...",
        retrievalStarted: "Started retrieval test for {{name}}",
      },
      metadataModal: {
        title: "Metadata Overview",
        totalDocuments: "Total Documents",
        totalDocumentsDescription:
          "Number of documents in the current knowledge base",
        enabledDocuments: "Available Documents",
        enabledDocumentsDescription:
          "Documents currently available for retrieval",
        totalChunks: "Total Chunks",
        totalChunksDescription:
          "Counted from the current document chunking results",
        summary:
          "This page is already connected to the real knowledge base API. We can later extend it with index quality, citation counts, and retrieval performance statistics.",
      },
      rebuildModal: {
        title: "Rebuild Index",
        description:
          "This will rerun chunking, vectorization, and index writing for {{name}}.",
        warning:
          "This capability is still being integrated, so confirming will currently show a placeholder message.",
      },
      deleteModal: {
        description:
          "After deletion, {{name}} and its related chunks and index data will be removed.",
        warning:
          "This action cannot be undone. Please confirm before continuing.",
      },
      banner:
        "No default vector model is connected right now, so knowledge base uploads are temporarily disabled.",
      filters: {
        searchPlaceholder: "Search document name, source, or status",
        sortPrefix: "Sort:",
        selectAllAria: "Select all visible rows",
        rowSelectAria: "Select {{name}}",
        moreActionsAria: "Open more actions for {{name}}",
      },
      table: {
        index: "#",
        name: "Name",
        segmentMode: "Segment Mode",
        charCount: "Chars",
        hits: "Hits",
        uploadedAt: "Uploaded At",
        status: "Status",
        actions: "Actions",
        empty:
          "There are no knowledge base files yet. Click Add File to start uploading.",
        tip: "Tip: double-click any row to open document details, and Add File will take you into the step-by-step upload flow.",
        summary: "{{total}} total documents, {{visible}} currently shown",
        stats: "{{enabled}} available documents · {{chunks}} total chunks",
      },
      status: {
        processing: "Processing",
        enabled: "Available",
        disabled: "Disabled",
      },
      detail: {
        notFoundTitle: "Document Not Found",
        notFoundDescription:
          "The `id` in the current URL does not match any real document. Please return from the knowledge base list.",
        previewTitle: "Chunk Preview",
        previewDescription:
          "This shows 10 evenly distributed real chunks so you can quickly verify the content after ingestion.",
        noChunks: "This document does not have chunk results yet.",
        chunkLabel: "Chunk {{index}}",
        basicInfo: "Basic Information",
        documentId: "Document ID",
        sourceType: "Source / Type",
        createdUpdated: "Created / Updated",
        tags: "Tags",
        charCount: "Character Count",
        charCountDescription:
          "Current stored character volume of this document",
        chunkCount: "Chunk Count",
        chunkCountDescription: "Counted from the real chunking results",
        fileSize: "File Size",
        fileSizeDescription: "Original size recorded at upload time",
        statusLabel: "Status",
        statusDescription: "Current index availability state for this document",
        emptySummary:
          "This document does not have a previewable content summary yet.",
      },
    },
    evaluation: {
      shared: {
        modeRetrieve: "Retrieve Only",
        modeRetrieveGenerate: "Retrieve + Generate",
        statusPass: "Pass",
        statusWarning: "Warning",
        statusError: "Error",
        sampleCount: "{{count}} samples",
        documentCount: "{{count}} documents",
        uploadedAt: "Uploaded at {{value}}",
        createdAt: "Created at {{value}}",
        completedAt: "Completed at {{value}}",
        noValue: "None",
      },
      status: {
        idle: "Not Started",
        ready: "Ready",
        queued: "Queued",
        running: "Running",
        completed: "Completed",
        failed: "Partially Failed",
        saved: "Saved",
      },
      metrics: {
        hitAtK: "Hit@K Retrieval Accuracy",
        recallAtK: "Recall@K Average Coverage",
        mrr: "MRR Ranking Quality",
        faithfulness: "Faithfulness to Sources",
        answerRelevance: "Relevance to Question",
        answerCompleteness: "Completeness of Answer",
        sourceHitRate: "Source Hit Rate",
        averageLatency: "Avg Latency  {{count}} failed",
      },
      workbench: {
        page: {
          miniTitle: "Evaluation Workbench",
          title: "Evaluation Workbench",
          description:
            "Upload a packaged evaluation ZIP to parse its dataset and runtime settings. This page focuses on validation and preview only; adjust parameters by regenerating the ZIP.",
        },
        actions: {
          generatePackage: "Generate Package",
          startEvaluation: "Start Evaluation",
        },
        messages: {
          uploadZip: "Please upload a dataset.zip evaluation package",
          parseSuccess: "Evaluation package parsed. You can start the run now.",
          parseFailed: "Failed to parse the evaluation package",
          uploadFirst: "Please upload an evaluation package first",
          validationError:
            "This evaluation package has validation errors. Please fix them and upload again.",
          runCreated:
            "Evaluation run created and will appear automatically in the Evaluation Center",
        },
        stateBar: {
          taskStatus: "Task Status",
          dataset: "Dataset",
          progress: "Progress",
          mode: "Mode",
          params: "Params",
          waitingUpload: "Waiting for upload",
        },
        preview: {
          closeMask: "Close dataset preview",
          closeDrawer: "Close preview drawer",
          title: "Random Dataset Preview",
          samplePreview: "Sample Preview",
          documentPreview: "Document Preview",
          goldSources: "Gold Sources",
          reference: "Reference",
        },
        packageCard: {
          title: "Package and Parameters",
          description:
            "After upload, the ZIP is parsed for mode, topK, topN, and N. This page is read-only for parameters.",
          parsing: "Parsing evaluation package, please wait...",
          helper:
            "dataset.zip is supported. Upload again to replace the current package.",
          dataset: "Dataset",
          runtimeConfig: "Runtime Config",
          openPreview: "Open Preview",
          previewHint:
            "The preview opens in a drawer so the main layout stays focused.",
        },
        validation: {
          title: "Pre-run Validation",
          hint: "Think of this like form validation: fix the ZIP content and upload it again.",
          empty:
            "Validation results for package structure, sample fields, and reference data will appear here after parsing.",
        },
        console: {
          log: "Run Log",
          result: "Results",
          savedHint:
            "This run has been automatically registered in the Evaluation Center",
          unsavedHint: "A run will be registered automatically after creation",
          emptyLog:
            "After you upload a package, parsing progress and runtime logs will appear here.",
          summary: "Summary",
          success: "Success",
          failure: "Failure",
          emptyResultTitle: "Results are empty for now",
          emptyResultDescription:
            "Once the evaluation starts, the right panel will switch to the Results tab automatically and show summary metrics for this run.",
          resultSummary: "{{count}} results aggregated",
        },
      },
      center: {
        page: {
          miniTitle: "Evaluation Center",
          title: "Evaluation Center",
          description:
            "Completed evaluation runs are stored here. The table stays concise, and the drawer reveals configuration, metrics, logs, and sample details.",
        },
        messages: {
          loadFailed: "Failed to load evaluation runs",
          downloadStarted: "Started downloading {{name}}.md",
          exportFailed: "Failed to export Markdown",
          deleted: "Deleted evaluation run {{name}}",
          deleteFailed: "Failed to delete evaluation run",
        },
        deleteModal: {
          title: "Delete Evaluation Run",
          description:
            "After deletion, {{name}} and all of its metrics, logs, and sample results will be removed.",
          warning:
            "This action cannot be undone, and running tasks cannot be deleted.",
          confirm: "Delete",
          deleting: "Deleting...",
        },
        table: {
          name: "Run Name",
          status: "Status",
          sampleCount: "Samples",
          keyMetrics: "Key Metrics",
          completedAt: "Completed At",
          actions: "Actions",
        },
        searchPlaceholder: "Search run name or dataset",
        recordCount: "Runs: {{count}}",
        loading: "Loading evaluation runs...",
        empty:
          "There are no evaluation runs yet. Create one from the Evaluation Workbench and it will appear here.",
        noMatch: "No evaluation runs match the current search.",
      },
      detailDrawer: {
        closeMask: "Close details drawer",
        closeDrawer: "Close drawer",
        runtimeConfig: "Runtime Config",
        dataset: "Dataset",
        modeRepeat: "Mode {{mode}} · Repeat {{count}} times",
        datasetSummary: "Documents {{documents}} · Samples {{samples}}",
        validations: "Validation Results",
        sampleDetails: "Sample Details",
        sampleStatusLine: "{{id}} · {{status}} · {{latency}}",
        success: "Success",
        failure: "Failure",
        goldSources: "Gold Sources",
        matchedSources: "Matched",
        recall: "Recall",
        faithfulness: "Faithfulness",
        relevance: "Relevance",
        completeness: "Completeness",
        retrievedSources: "Retrieved Sources",
        noRetrievedSources: "No retrieved sources available to display.",
        attempts: "Attempts",
        attempt: "Attempt {{count}}",
        attemptRecall: "recall {{value}}",
        attemptRelevance: "rel {{value}}",
        attemptCompleteness: "comp {{value}}",
        runLogs: "Run Logs",
        deleteRecord: "Delete Run",
        deleting: "Deleting...",
        downloadMarkdown: "Download Markdown",
      },
      packageGenerator: {
        title: "Generate Evaluation Package",
        intro:
          "Sample documents and chunks from the current default knowledge base, use the long-term evaluation model from Model Settings to generate questions and reference answers, then export an uploadable ZIP package.",
        provider: "Current Evaluation Provider",
        model: "Current Evaluation Model",
        notConfigured: "Not Configured",
        configureModelFirst: "Configure it first in Model Settings",
        datasetName: "Dataset Name",
        sampleCount: "Sample Count",
        documentCount: "Sampled Documents",
        chunksPerDocument: "Chunks per Document",
        mode: "Mode",
        concurrency: "Concurrency",
        timeoutSeconds: "Timeout (sec)",
        modeRetrieveGenerate: "Retrieve + Generate",
        modeRetrieve: "Retrieve Only",
        summary:
          "This version samples available documents and chunks from the default knowledge base and uses the configured evaluation model to generate samples. The exported ZIP can be uploaded back into this workbench directly.",
        generating: "Generating...",
        generateAndDownload: "Generate and Download",
        messages: {
          configureEvaluationModel:
            "Please configure a default evaluation model in Model Settings first",
          generated: "Evaluation package generated and download started",
          failed: "Failed to generate evaluation package",
        },
        help: {
          datasetName:
            "The exported package name, mainly for distinguishing batches. It does not affect evaluation logic.",
          sampleCount:
            "How many evaluation samples to generate. For example, 8 will create 8 questions with reference answers.",
          documentCount:
            "How many documents to sample from the default knowledge base for this package. Larger values spread the source material more widely.",
          chunksPerDocument:
            "How many chunks to take from each sampled document as question material. Larger values cover more content per document.",
          mode: "Retrieve Only evaluates retrieval quality. Retrieve + Generate also creates reference Q&A and is better for end-to-end RAG evaluation.",
          topK: "How many candidate chunks to retrieve first at runtime. Higher values improve coverage but may add noise.",
          topN: "How many items from TopK are kept for downstream evaluation or generation. Usually this should be less than or equal to TopK.",
          repeat:
            "How many times each sample is executed. Useful for observing stability; 1 means each sample runs once.",
          concurrency:
            "How many sample tasks run at the same time. Higher values are faster but use more model and machine resources; for local models, start with 1.",
          timeoutSeconds:
            "How long a single sample may run before being marked as failed. Increase it if local models are slow.",
        },
      },
    },
    general: {
      page: {
        miniTitle: "General",
        title: "General",
        description:
          "Manage interface preferences and account actions in one place.",
      },
      preferences: "Preferences",
      language: {
        label: "Interface Language",
        options: {
          "zh-CN": "Simplified Chinese",
          "en-US": "English",
        },
      },
      theme: {
        label: "Color Theme",
        presets: {
          "warm-neutral": {
            label: "Warm Neutral",
            description:
              "Keeps the paper-like warmth of the current product, ideal for long reading, configuration, and review sessions.",
          },
          "knowledge-blue": {
            label: "Knowledge Blue",
            description:
              "Emphasizes information structure and clarity, fitting retrieval, evaluation, and admin workflows.",
          },
          "archive-green": {
            label: "Archive Green",
            description:
              "A calmer, more restrained tone for long document reviews, log analysis, and knowledge base work.",
          },
          "slate-ocean": {
            label: "Slate Ocean",
            description:
              "Cool and steady without feeling harsh, well suited to monitoring, debugging, and system status views.",
          },
        },
      },
      darkMode: {
        label: "Dark Mode",
        ariaLabel: "Toggle dark mode",
      },
      account: {
        changePassword: "Change Password",
      },
      password: {
        modalTitle: "Change Password",
        title: "Change Password",
        description:
          "Your new password must be at least 6 characters and different from the current one. Changes take effect immediately after saving.",
        current: "Current Password",
        currentPlaceholder: "Enter your current password",
        next: "New Password",
        nextPlaceholder: "Enter a new password",
        confirm: "Confirm New Password",
        confirmPlaceholder: "Enter the new password again",
        mismatch: "The new passwords do not match",
        sameAsCurrent:
          "The new password must be different from the current password.",
        submitInvalid: "Please review the password fields before submitting.",
        success:
          "Password updated. Please use the new password for future sign-ins.",
        failed: "Failed to change password. Please try again later.",
        submit: "Update Password",
        submitting: "Saving...",
      },
      health: {
        title: "Runtime Platform",
        detailAriaLabel: "View details",
        services: {
          server: "Server",
          sqlite: "SQLite",
          sqliteVec: "SQLite-vec",
        },
        details: {
          desktopBackendUnavailable:
            "Desktop runtime is not connected to the local backend",
          desktopDatabaseUnavailable:
            "Desktop runtime is not connected to database checks",
          desktopVectorUnavailable:
            "Desktop runtime is not connected to vector store checks",
          waitingBackend: "Waiting for backend health check",
          waitingDatabase: "Waiting for database connectivity check",
          waitingVector: "Waiting for vector store check",
          databaseUnexpected:
            "Database health check returned an unexpected status",
          backendRunning: "Backend is running · {{url}}",
          backendUnavailableForDatabase:
            "Backend is unavailable, so database status cannot be checked",
          backendUnavailableForVector:
            "Backend is unavailable, so vector extension status cannot be checked",
          healthCheckFailed: "Health check failed",
        },
        logs: {
          export: "Export Logs ZIP",
          exporting: "Exporting...",
          exportSuccess: "Log archive download has started",
          exportFailed: "Failed to export logs",
          clear: "Clear Logs",
          clearTitle: "Confirm Log Cleanup",
          clearDescription:
            "This will clear the current contents of `server.log` and `error.log`.",
          clearWarning:
            "The log files will remain, but their contents will be removed. This action cannot be undone.",
          clearConfirm: "Clear Logs",
          clearSuccess: "Logs cleared, {{size}} KB released",
          clearFailed: "Failed to clear logs",
        },
      },
    },
    model: {
      page: {
        miniTitle: "Model Settings",
        title: "Model Settings",
        description:
          "On this page, you can select and configure language models for Q&A. The platform handles connections and model synchronization, while this page displays the current role configurations and allows you to save parameters directly.",
      },
      actions: {
        resetDefault: "Reset Default Models",
        openSettings: "Model Settings",
        confirmReset: "Confirm Reset",
      },
      resetModal: {
        title: "Confirm Reset Default Models",
        description:
          "This will clear the default models for LLM, Embedding, Rerank, Task, and Evaluation, and restore default parameters.",
        warning:
          "This operation will affect the default model selection for current conversations and knowledge bases.",
        success: "Default models have been reset",
        failed: "Reset failed",
      },
      defaultCard: {
        platformSettingsTitle: "Platform Model Settings",
        close: "Close",
        done: "Done",
        syncing: "Synchronizing model configuration...",
      },
      config: {
        llm: {
          title: "LLM",
          subtitle: "For conversation generation and text understanding",
        },
        task: {
          title: "Task Model Configuration",
          subtitle: "For task execution and workflow orchestration",
          readOnlyHint:
            "The default binding for task models can be adjusted in platform model settings; parameters are managed by the system for lightweight task scheduling such as retrieval rewriting. The current interface only displays the effective configuration.",
        },
        evaluation: {
          title: "Evaluation Model",
          subtitle:
            "For evaluation package generation and generative evaluation judges",
        },
        embedding: {
          title: "Embedding",
          subtitle: "For vectorization and semantic retrieval",
        },
        rerank: {
          title: "ReRank",
          subtitle: "For result reranking and relevance assessment",
        },
        configured: "Configured",
        notConfigured: "Not Configured",
        managed: "System Managed",
        currentPlatform: "Current Platform",
        currentModel: "Current Model",
        selectModel: "Please select in platform model settings",
        save: "Save",
        saving: "Saving...",
        saved: "Parameters saved",
        saveFailed: "Failed to save parameters",
      },
      platform: {
        title: "Platform List",
        bound: "Bound {{roles}}",
        waitingSync: "Waiting for model sync",
      },
      api: {
        selectPlatform: "Please select a platform on the left.",
        description:
          "After saving the connection configuration, synchronize the model list through the server; successful synchronization indicates the platform link is available.",
        selectModel: "Select model...",
        noModels: "No models available, please sync first",
        apiKey: "API Key",
        apiKeyPlaceholder: "Enter API key",
        apiUrl: "API URL",
        apiUrlPlaceholder: "Enter API URL",
        previewUrl: "Preview request URL: {{url}}/api/chat",
        currentModel: "Current Model",
        syncAriaLabel: "Save configuration and sync models",
        syncSuccess: "Model synchronization successful",
        syncFailed: "Failed to sync models",
        setDefaultLlm: "Set as Default LLM",
        setDefaultEmbedding: "Set as Default Embedding",
        setDefaultRerank: "Set as Default ReRank",
        setDefaultTask: "Set as Default Task",
        setDefaultEvaluation: "Set as Default Evaluation Model",
        setting: "Setting...",
        selectModelFirst: "Please select a model first",
        updatedLlm: "Default LLM model updated",
        updatedEmbedding: "Default Embedding model updated",
        updatedRerank: "Default ReRank model updated",
        updatedTask: "Default Task model updated",
        updatedEvaluation: "Default evaluation model updated",
        setDefaultFailed: "Failed to set default model",
        loadFailed: "Failed to load platform configuration",
        loadDetailFailed: "Failed to load platform details",
      },
      status: {
        idle: "Pending",
        syncing: "Syncing",
        connected: "Connected",
        error: "Error",
      },
      modelRow: {
        enabled: "Enabled",
        disabled: "Disabled",
        edit: "Edit",
        editAria: "Edit model",
        enable: "Enable",
        disable: "Disable",
        enableAria: "Enable model",
        disableAria: "Disable model",
        delete: "Delete",
        deleteAria: "Delete model",
      },
      platformConfig: {
        loadFailed: "Failed to load platform configuration",
        loadDetailFailed: "Failed to load platform details",
        syncSuccess: "Model synchronization successful",
        syncFailed: "Failed to sync models",
        selectModelFirst: "Please select a model first",
        updatedEvaluation: "Default evaluation model updated",
        updatedDefault: "Default {{role}} model updated",
        setDefaultFailed: "Failed to set default model",
      },
    },
  },
  auth: {
    login: {
      badge: "Desktop AI Workspace",
      title: "Start Your RAG Conversation Testing",
      description:
        "Sign in to continue model tuning, knowledge base verification, and chat testing.",
      featureContinueTitle: "Resume Current Progress",
      featureContinueDescription:
        "Keep the same account context and continue your current testing flow.",
      featureQuietTitle: "A Calm Sign-in Experience",
      featureQuietDescription:
        "Clear inputs and a low-noise interface keep your attention on the task itself.",
      welcomeBack: "Welcome Back",
      signIn: "Sign In",
      signInDescription: "Enter your account information to continue.",
      username: "Username",
      usernamePlaceholder: "Enter your username",
      password: "Password",
      passwordPlaceholder: "Enter your password",
      fieldError: "Please check your username and password and try again",
      requestFailed: "Sign-in request failed",
      signingIn: "Signing in...",
    },
  },
  chat: {
    thread: {
      header: {
        newConversation: "Start New Conversation",
        untitledConversation: "New Conversation",
      },
      models: {
        llm: "Unconfigured LLM",
        task: "Unconfigured Task",
        embedding: "Unconfigured Embedding",
        rerank: "Unconfigured Rerank",
      },
      welcome: {
        titlePrefix: "From documents to",
        titleHighlight: " answers",
        titleSuffix: ",",
        titleLine2: "with traceable evidence.",
        description:
          "Turn documents into knowledge you can query directly in real retrieval scenarios.",
        actions: {
          askKnowledgeBase: {
            title: "Ask the Knowledge Base",
            description:
              "Question your existing documents to quickly validate retrieval and answer quality.",
          },
          uploadDocument: {
            title: "Upload a Document",
            description:
              "Import material and ask questions right away to inspect retrieval flow and answer quality.",
          },
          askRealQuestion: {
            title: "Try a Real Question",
            description:
              "Ask naturally and see how the system organizes answers and sources.",
          },
        },
      },
      assistantTyping: "Assistant is typing a reply",
      sources: {
        title: "Sources",
        document: "Document #{{count}} · {{name}}",
        score: "Score {{value}}",
      },
      composer: {
        ragAria: "Enable RAG knowledge base retrieval",
        enableKnowledgeBase: "Enable Knowledge Base",
        ragEnabledHint:
          "Answers will prefer knowledge base content and show sources and execution details below each message.",
        ragAvailableHint:
          "Turn it off for normal chat, or enable it to inspect sources and retrieval steps.",
        ragUnavailableHint:
          "No documents are available yet. Upload content in Knowledge Base before enabling this.",
        thinking: "Assistant is thinking...",
        configureLlm: "Please configure a default LLM first...",
        configureEmbedding:
          "Please configure a default embedding model before enabling the knowledge base...",
        inputPlaceholder: "Type a question and press Enter...",
      },
    },
  },
  ui: {
    modal: {
      closeAria: "Close dialog",
    },
    select: {
      empty: "Please select",
      noOptions: "No options available",
    },
  },
} as const;

export default enUS;
