// Vercel Serverless Function entry point — wraps the Express app
// This file is picked up by Vercel's `api/` directory convention
// See: https://vercel.com/docs/functions/serverless-functions
import app from '../server/src/index.js';

export default app;
