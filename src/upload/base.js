export const DEFAULT_CHUNK_SIZE = 4; // 单位 MB
const GB = 1024 ** 3;

const putExtraMethods = {
  fileName: function() {
    return this.file && this.file.name;
  },
  fileSize: function() {
    return this.file && this.file.size;
  },
  fileKey: function() {
    return this.getLocalKey();
  },
  chunkSize: function() {
    return this.config.chunkSize;
  },
  totalChunksCount: function() {
    return this.chunks && this.chunks.length;
  },
  chunkIndex: function() {
    console.warn('无法通过该方法获取chunkIndex，请直接在uploadchunk方法中获取');
  },
  file: function() {
    console.warn('无法通过该方法获取file, 请直接在uploadChunk方法中获取');
  }
};

const putExtraFiled = {
  file: function() {
    return this.putExtra && this.putExtra.file || 'file';
  },
  fileName: function() {
    return this.putExtra && this.putExtra.fileName || 'fileName';
  },
  fileSize: function() {
    return this.putExtra && this.putExtra.fileSize || 'fileSize';
  },
  fileKey: function() {
    return this.putExtra && this.putExtra.fileKey || 'fileKey';
  },
  chunkSize: function() {
    return this.putExtra && this.putExtra.chunkSize || 'chunkSize';
  },
  totalChunksCount: function() {
    return this.putExtra && this.putExtra.totalChunksCount || 'totalChunksCount';
  },
  chunkIndex: function() {
    return this.putExtra && this.putExtra.chunkIndex || 'chunkIndex';
  },
};

class Base {
  constructor(options, handlers) {
    this.xhrList = [];
    this.aborted = false;
    this.retryCount = 0;
    this.config = Object.assign({
      path: '', // 上传请求url
      uploadChunkMethod: 'PUT',
      uploadCompleteMethod: 'POST',
      chunkHeaders: {}, // 上传分片时的headers配置
      mkHeaders: {},    // 上传完成请求的headers
      requestIdField: 'requestId', // 上传请求响应头中返回的请求id字段
      retryCount: 3,
      checkByMD5: false,
      forceDirect: false,
      forceResume: false,
      chunkSize: DEFAULT_CHUNK_SIZE,
      concurrentRequestLimit: 3 // 请求并发数
    }, options.config);
    this.customVars = options.customVars;
    this.putExtraFields = ['fileName', 'fileSize', 'fileKey', 'chunkSize', 'totalChunksCount', 'chunkIndex', 'file'];
    this.putExtra = options.putExtra;
    this.file = options.file;
    this.key = options.key; // 上传文件的唯一标识
    this.onData = handlers.onData;
    this.onError = handlers.onError;
    this.onComplete = handlers.onComplete;
  }

  getPutExtraData(field) {
    const extrafield = field && putExtraFiled[field].call(this);
    return extrafield && putExtraMethods[extrafield] && putExtraMethods[extrafield].call(this) || '';
  }

  getPutExtraField(field) {
    return putExtraFiled[field].call(this);
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
      this.uploadUrl = this.config.path;
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