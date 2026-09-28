const port = Number.parseInt(process.env.PORT || "3000", 10);
const hostname = "0.0.0.0";
const dev = process.env.NODE_ENV !== "production";

process.on("uncaughtException", (error) => {
  console.error("startup-uncaught-exception", error);
  process.exit(1);
});

process.on("unhandledRejection", (error) => {
  console.error("startup-unhandled-rejection", error);
  process.exit(1);
});

async function startServer() {
  try {
    const [{ createServer }, { default: next }] = await Promise.all([import("node:http"), import("next")]);
    const app = next({ dev, hostname, port });
    const handle = app.getRequestHandler();

    await app.prepare();

    const server = createServer((request, response) => {
      handle(request, response).catch((error) => {
        console.error("request-handler-failed", error);

        if (!response.headersSent) {
          response.statusCode = 500;
          response.end("Internal Server Error");
        } else {
          response.destroy(error);
        }
      });
    });

    server.on("error", (error) => {
      console.error("server-listen-failed", error);
      process.exit(1);
    });

    server.listen(port, hostname, () => {
      console.log(`Servidor Next.js ativo em ${hostname}:${port}`);
    });
  } catch (error) {
    console.error("server-startup-failed", error);
    process.exit(1);
  }
}

startServer();
