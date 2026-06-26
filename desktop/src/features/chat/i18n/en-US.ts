const chatPending = {
  chat: {
    sidebar: {
      newConversation: "+ New Conversation",
      untitledConversation: "New Conversation",
      archive: "Archive",
      delete: "Delete",
    },
    page: {
      statusUnknown: "Checking",
      statusRunning: "Running",
      statusStopped: "Stopped",
      welcomeMessage: "Hello, I am {{appName}}. Please enter your question.",
      suggestion1: "Summarize today's task priorities",
      suggestion2: "Give me a RAG system troubleshooting checklist",
      suggestion3: "Design an interface integration plan",
      inputPlaceholder: "Enter your question and press Enter to send...",
    },
    ragDrawer: {
      copyJson: "Copy JSON",
      closeDetail: "Close execution details",
      copySuccess: "JSON copied",
      copyFailed: "Copy failed, please try again",
    },
    executionTrace: {
      title: "RAG Flow",
      stepCount: "{{completed}} / {{total}} steps",
      status: {
        running: "Running",
        completed: "Completed",
        failed: "Failed",
      },
    },
    threadProvider: {
      defaultTitle: "New Conversation",
    },
    provider: {
      placeholderReply: "(Backend not connected; placeholder reply)",
    },
    adapter: {
      listFailed: "Failed to get conversation list: {{error}}",
      renameFailed: "Failed to rename conversation: {{error}}",
      archiveFailed: "Failed to archive conversation: {{error}}",
      unarchiveFailed: "Failed to unarchive conversation: {{error}}",
      deleteFailed: "Failed to delete conversation: {{error}}",
      createFailed: "Failed to create conversation: {{error}}",
      fetchFailed: "Failed to get conversation details: {{error}}",
      saveMessageFailed: "Failed to save message: {{error}}",
      unknownError: "Unknown error",
    },
    parsers: {
      unnamedNode: "Unnamed Node",
      doubleHit: "Double Hit",
      keywordHit: "Keyword Hit",
      semanticHit: "Semantic Hit",
      knowledgeBaseHit: "Knowledge Base Hit",
      rewriteLabel: "Rewriting Query",
      rewriteSummary: "Rewriting question for better retrieval",
      embedLabel: "Generating Embedding",
      embedSummary: "Preparing query vectors for semantic retrieval",
      retrieveLabel: "Retrieving Candidates",
      retrieveSummary: "Filtering relevant content from knowledge base",
      rerankLabel: "Reranking Results",
      rerankSummary: "Reordering candidate fragments",
      generateLabel: "Generating Final Answer",
      generateSummary: "Combining sources to generate final response",
      inProgress: "{{label}} in progress",
      failed: "{{label}} failed",
      completed:
        "Retrieval and response generation completed. Expand to view sources and process.",
    },
    title: {
      default: "New Conversation",
    },
    localModel: {
      replyPrefix: "Received: {{prompt}}",
      replySuffix:
        "This is a local uchat demo reply. You can continue entering questions, and later replace it with a real backend inference interface.",
      greeting:
        "Hello, I am your RAG assistant. Please tell me what you want to query.",
    },
  },
} as const;

export default chatPending;
