const Koa = require('koa');
const Router = require('koa-router');
const multer = require('koa-multer');

const app = new Koa();
const router = new Router();
const upload = multer({
  dest: './files/'
});
// routes
router.post('/upload', upload.any());

app.use(router.routes());
app.listen(5000);