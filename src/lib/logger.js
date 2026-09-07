import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

const transport = pino.transport({
  targets: [
    // 🔴 ONLY Warnings and Errors go into error.log (levels 40 and 50)
    {
      target: "pino/file",
      level: "warn",
      options: { destination: "./logs/error.log", mkdir: true },
    },
    // 🟢 Everything (INFO level 30 and up) goes into combined.log
    {
      target: "pino/file",
      level: "info",
      options: { destination: "./logs/combined.log", mkdir: true },
    },
    // 💻 Dev Terminal Console Settings
    ...(!isProduction
      ? [
          {
            target: "pino-pretty",
            level: "info", // Shows info, warn, and error in your terminal
            options: { colorize: true },
          },
        ]
      : []),
  ],
});

export const logger = pino(transport);
