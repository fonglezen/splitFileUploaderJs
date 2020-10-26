export class Pool {
  constructor(runTask, limit) {
    this.runTask = runTask;
    this.limit = limit;
    this.queue = [];
    this.processing = [];
  }

  // 上传任务入队列，任务属性包含任务，resolve回调函数和reject回调函数
  enqueue(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        task,
        resolve,
        reject
      });
      this.check();
    });
  }

  // 执行队列任务
  run(item) {
    // 更新队列数据，疑问：为什么要用filter而不是直接splice？是因为复制比移动消耗更少？
    this.queue = this.queue.filter(v => v !== item);
    // 添加item到处理中的队列
    this.processing.push(item);
    // 执行任务
    this.runTask(item.task).then(() => {
      // 任务执行完成后， 更新
      this.processing = this.processing.filter(v => v !== item);
      // 调用item的resolve
      item.resolve();
      this.check();
    }, err => item.reject(err));
  }

  // 检查队列状态，继续执行队列任务
  check() {
    const processingNum = this.processing.length;
    const availableNum = this.limit - processingNum;
    // 获取限制数量内可执行的任务，limit减去目前还在执行中的任务数量
    this.queue.slice(0, availableNum).forEach(item => {
      this.run(item);
    });
  }
}