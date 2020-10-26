import {
  getUploadUrl
} from '../api';
export const DEFAULT_CHUNK_SIZE = 4; // 单位 MB
const GB = 1024 ** 3;

class Base {
  constructor(options, handlers) {
    this.xhrList = [];
    this.aborted = false;
    this.retryCount = 0;
    this.config = Object.assign({
      chunkHeaders: {},
      mkHeaders: {},
      requestIdField: 'requestId', // 上传请求响应头中返回的请求id字段
      keyParamName: 'key',
      fileParamName: 'file',
      useCdnDomain: true,
      disableStatisticsReport: false,
      retryCount: 3,
      checkByMD5: false,
      uphost: '',
      upprotocol: 'https:',
      forceDirect: false,
      chunkSize: DEFAULT_CHUNK_SIZE,
      concurrentRequestLimit: 3 // 请求并发数
    }, options.config);
    this.customVars = options.customVars;
    this.file = options.file;
    this.key = options.key; // 上传文件的唯一标识
    this.onData = handlers.onData;
    this.onError = handlers.onError;
    this.onComplete = handlers.onComplete;
  }
  async putFile() {
    this.aborted = false;
    if (this.file.size > 10000 * GB) {
      const err = new Error('file size exceed maximum value 10000G');
      this.onError(err);
      throw err;
    }
    try {
      // 获取上传文件请求url
      this.uploadUrl = await getUploadUrl(this.config);
      this.uploadAt = new Date().getTime();
      // 开始上传文件，调用run()方法，run方法不在base类中定义，在Direct和Resume类中实现
      const result = await this.run();
      // 调用完成handler回调函数
      this.onComplete(result.data);
      // 返回上传结果
      return result;
    } catch (err) {
      this.clear();

      const needRetry = err.isRequestError && err.code === 0 && !this.aborted;
      const notReachRetryCount = ++this.retryCount <= this.config.retryCount;
      // 以下条件满足其中之一则会进行重新上传：
      // 1. 满足 needRetry 的条件且 retryCount 不为 0
      // 2. uploadId 无效时在 resume 里会清除本地数据，并且这里触发重新上传
      if (needRetry && notReachRetryCount || err.code === 612) {
        // 重试
        return this.putFile();
      }
      this.onError(err);
      throw err;
    }
  }
  clear() {
    // 中断所有请求，并清空队列
    this.xhrList.forEach(xhr => xhr.abort());
    this.xhrList = [];
  }
  stop() {
    // 停止上传，清空并设置中断状态
    this.clear();
    this.aborted = true;
  }
  addXhr(xhr) {
    // 入请求队列
    this.xhrList.push(xhr);
  }

  /**
   * 获取进度
   * @param {number} loaded 已上传大小
   * @param {number} size 总大小
   */
  getProgressInfoItem(loaded, size) {
    return {
      loaded,
      size,
      percent: loaded / size * 100
    };
  }
}
export default Base;