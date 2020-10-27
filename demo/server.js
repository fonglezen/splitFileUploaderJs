const Koa = require('koa');
const Router = require('koa-router');

const app = new Koa();
const router = new Router();

// routes
router.post('/upload', async (ctx) => {
  // 先答应获取到的数据看看
  console.log(ctx);
});

app.use(router.routes());
app.listen(5000);