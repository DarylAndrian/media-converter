const { execSync } = require("child_process");

if (process.env.NETLIFY === "true") {
  execSync("npm install --platform=linux --arch=x64 sharp", {
    stdio: "inherit",
  });
}
