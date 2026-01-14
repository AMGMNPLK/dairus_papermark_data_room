import { createVertex } from "@ai-sdk/google-vertex";

const vertex = createVertex({
  apiKey: process.env.GOOGLE_VERTEX_API_KEY || "dummy-key-for-build",
});

export { vertex };
