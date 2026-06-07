const CONFIG = {
  PORT: Number(process.env.PORT ?? 8787),
  HOST: "0.0.0.0",
  DATABASE_DIR: "data",
  DATABASE_NAME: "uichat-rag-test.db",
  SWAGGER_PREFIX: "/docs",
  LOG_DIR: "logs",
};

export default CONFIG;
