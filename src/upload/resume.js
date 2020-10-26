import * as utils from '../utils';
import {
  Pool
} from '../pool';
import {
  uploadChunk,
  uploadComplete,
} from '../api';
import Base from './base';
/** 是否为正整数 */
function isPositiveInteger(n) {
  var re = /^[1-9]\d*$/;
  return re.test(String(n));
}

export default class Resume extends Base {
  // 开始分片上传
  async run() {
    // 判断分片大小是否正确
    if (!this.config.chunkSize || !isPositiveInteger(this.config.chunkSize)) {
      throw new Error('chunkSize must be a positive integer');
    }
    // 单片大小最大为1G
    if (this.config.chunkSize > 1024) {
      throw new Error('chunkSize maximum value is 1024');
    }

    // 初始化工作，初始化进度、分片数据、上传文件信息等
    await this.initBeforeUploadChunks();

    // 创建上传池，池最大数量为并发数，默认为3，通过options.config.concurrentRequestLimit自定义，当不应该设置过大，跟浏览器的并发请求数相关
    // pool.__proto__.constructor(runTask, limit)，创建pool对象
    // 注意这里的箭头函数，所以this指的是Resume对象总的this.uploadChunk()方法
    const pool = new Pool((chunkInfo) => this.uploadChunk(chunkInfo), this.config.concurrentRequestLimit);
    // 生成上传分片任务，遍历分片，把分片任务入队，返回promise数组
    const uploadChunks = this.chunks.map((chunk, index) => pool.enqueue({
      chunk,
      index
    }));
    // 执行任务promise，promise任务包括push task，以及执行pool.check(）
    // pool.check() 判断当前是否有空闲“线程”，如果有则执行pool.run()
    // pool.run() 执行栈:
    // [pool.runTask, resume.uploadChunk(), resume.updateChunkProgress(), utils.computeMd5(), 
    // resume.updateChunkProgress(), api.uploadChunk(), resume.updateChunkProgress(), utils.setLocalFileInfo()]
    // 当pool.runTask()出栈后，则执行 pool.resolve()方法，该item执行完毕，继续调用pool.check()方法，知道Promise.all()中promise全部完成
    // 调用resume.mkFileReq()方法
    // 该方法未异步执行，入栈后，执行下一行
    const result = Promise.all(uploadChunks).then(() => this.mkFileReq());

    // 该行代码为result的链式then方法，入微任务队列，执行下一行代码
    // 开始进行上传请求，完成上传后执行清理工作
    result.then(() => {
      // 清除本地上传缓存信息
      utils.removeLocalFileInfo(this.getLocalKey());
    }, err => {
      console.warn(err);
    });

    // 返回上传任务结果<promise.all>
    return result;
  }

  // 上传
  async uploadChunk(chunkInfo) {
    const {
      index,
      chunk
    } = chunkInfo;
    const info = this.uploadedList[index];
    const shouldCheckMD5 = this.config.checkByMD5;
    const reuseSaved = () => {
      this.updateChunkProgress(chunk.size, index);
    };
    if (info && !shouldCheckMD5) {
      reuseSaved();
      return;
    }
    const md5 = await utils.computeMd5(chunk);
    if (info && md5 === info.md5) {
      reuseSaved();
      return;
    }
    const onProgress = (data) => {
      this.updateChunkProgress(data.loaded, index);
    };
    const requestOptions = {
      body: chunk,
      headers: this.config.chunkHeaders,
      onProgress,
      onCreate: (xhr) => this.addXhr(xhr),
      requestIdField: this.config.requestIdField,
    };
    const response = await uploadChunk(this.key, chunkInfo.index + 1, this.getUploadInfo(), requestOptions);
    // 在某些浏览器环境下，xhr 的 progress 事件无法被触发，progress 为 null，这里在每次分片上传完成后都手动更新下 progress
    onProgress({
      loaded: chunk.size,
      total: chunk.size
    });
    this.uploadedList[index] = {
      etag: response.data.etag,
      md5: response.data.md5,
      size: chunk.size
    };
    utils.setLocalFileInfo(this.getLocalKey(), {
      id: this.uploadId,
      data: this.uploadedList
    });
  }

  /**
   * 全部分片上传完成，执行完成上传后的任务
   */
  async mkFileReq() {
    // 需要额外提交的数据
    const data = Object.assign({}, this.customVars);
    // 调用api.uploadComplete()
    const result = await uploadComplete(this.token, this.key, this.getUploadInfo(), {
      onCreate: xhr => this.addXhr(xhr),
      body: JSON.stringify(data),
      headers: this.config.mkHeaders,
      requestIdField: this.config.requestIdField,
    });
    this.updateMkFileProgress(1);
    return result;
  }

  /**
   * 上传前文件处理，设置分片信息
   */
  async initBeforeUploadChunks() {
    const localKey = this.getLocalKey();
    // 获取本地标识对象
    const localInfo = utils.getLocalFileInfo(localKey);
    // 分片必须和当时使用的 uploadId 配套，所以断点续传需要把本地存储的 uploadId 拿出来
    // 假如没有 localInfo 本地信息并重新获取 uploadId
    if (!localInfo) {
      // 防止本地信息已被破坏，初始化时 clear 一下
      utils.removeLocalFileInfo(localKey);
      // 本地信息损坏和移除了，uploadId直接使用生成的缓存key，已上传分片列表数据为空
      this.uploadId = localKey;
      this.uploadedList = [];
    } else {
      // 如果本地已有缓存（断点续传的本地缓存判断），则uploadId为缓存信息的id，已上传分片列表为data
      this.uploadId = localInfo.id;
      this.uploadedList = localInfo.data;
    }
    // 获取文件分片大小
    this.chunks = utils.getChunks(this.file, this.config.chunkSize);
    // 初始化上传信息进度，mkFileProgress 标记是否已完成，未完成时为0，已完成后设置为1， chunks 每个分片的已上传文件大小
    this.loaded = {
      mkFileProgress: 0, // 值为0或者1，上传完成时会被设置为1
      chunks: this.chunks.map(_ => 0)
    };
    // 更新
    this.notifyResumeProgress();
  }


  /**
   * 返回当前上传文件的uploadId和uploadUrl
   */
  getUploadInfo() {
    return {
      id: this.uploadId,
      url: this.uploadUrl
    };
  }

  /**
   * 获取文件唯一标识信息，通过文件名称，唯一标识和大小来生成
   */
  getLocalKey() {
    return utils.createLocalKey(this.file.name, this.key, this.file.size);
  }

  /**
   * 更新分片上传进度数据
   * @param {*} loaded 分片已上传大小
   * @param {*} index 分片索引
   */
  updateChunkProgress(loaded, index) {
    this.loaded.chunks[index] = loaded;
    this.notifyResumeProgress();
  }

  /**
   * 上传完成，设置mkFileProgress为1
   * @param {*} progress 
   */
  updateMkFileProgress(progress) {
    this.loaded.mkFileProgress = progress;
    this.notifyResumeProgress();
  }

  /**
   * 通知更新上传进度
   * getProgressInfoItem 方法来自base
   */
  notifyResumeProgress() {
    // utils.sum(this.loaded.chunks) 求每一个分片已上传大小之和
    // this.loaded.mkFileProgress 上传中 = 0， 上传完成 = 1 , 也就是上传过程中，总不会达到100%，上传结束，文件大小已+1，则正确情况为100%
    // loaded 上传中为所有分片已上传之和，如果上传完成后则为上传分片大小之和+1
    const loaded = utils.sum(this.loaded.chunks) + this.loaded.mkFileProgress;
    // 文件大小 + 1
    const size = this.file.size + 1;
    this.progress = {
      // 整体上传进度，返回{loaded, size, percent: loaded / size * 100}
      total: this.getProgressInfoItem(loaded, size),
      // 每一个chunk的上传进度，[]
      chunks: this.chunks.map((chunk, index) => (this.getProgressInfoItem(this.loaded.chunks[index], chunk.size))),
      // 上传信息
      uploadInfo: {
        id: this.uploadId,
        url: this.uploadUrl
      }
    };
    // 调用onData回调函数, onData  继承自base, 来源于用户传入的handlers的onData
    this.onData(this.progress);
  }
}