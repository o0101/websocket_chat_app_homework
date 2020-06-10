import express from 'express';
import path from 'path';

export const DEFAULT_PORT = 8080;
export const PORT = process.env.LSD_PORT || Number(process.argv[2] || DEFAULT_PORT);
const APP_ROOT = path.dirname(path.resolve(process.mainModule.filename));
const app = express();

app.use(express.static(path.resolve(APP_ROOT, 'public')));
app.listen(PORT);

