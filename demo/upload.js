(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["uploader"] = factory();
	else
		root["uploader"] = factory();
})(self, function() {
return /******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ([
/* 0 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => __WEBPACK_DEFAULT_EXPORT__
/* harmony export */ });
/* harmony import */ var _upload__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1);
/* harmony import */ var _observable__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(9);



/**
 * 返回一个上传Observable对象
 * @param {File} params0.file 需要上传的文件
 * @param {string} params0.key 上传文件的唯一标识
 * @param {object} params0.config 上传配置
 */
function upload({file, key, config, customVars, putExtra}) {
  const options = {
    file,
    key,
    config,
    customVars,
    putExtra,
  }
  const createManager = (observer) => {
    const manager = (0,_upload__WEBPACK_IMPORTED_MODULE_0__.default)(options, {
        onData: (data) => observer.next(data),
        onError: (err) => observer.error(err),
        onComplete: (res) => observer.complete(res)
    });
    manager.putFile();
    return manager.stop.bind(manager);
  };

  return new _observable__WEBPACK_IMPORTED_MODULE_1__.Observable(createManager);
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (upload);

/***/ }),
/* 1 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DEFAULT_CHUNK_SIZE": () => /* reexport safe */ _base__WEBPACK_IMPORTED_MODULE_3__.DEFAULT_CHUNK_SIZE,
/* harmony export */   "default": () => /* binding */ createUploadManager
/* harmony export */ });
/* harmony import */ var _resume__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2);
/* harmony import */ var _direct__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(8);
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3);
/* harmony import */ var _base__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(6);






function createUploadManager(options, handlers) {
  // config.forceDirect: 
  // 是否上传全部采用直传方式，为布尔值；为 `true` 时则上传方式全部为直传 form 方式，禁用断点续传，默认 `false`。
  if (options.config && options.config.forceDirect) {
      return new _direct__WEBPACK_IMPORTED_MODULE_1__.default(options, handlers);
  }
  // 是否强制为分片模式，如果是则不进行判断，直接使用分片上传
  if(options.config && options.config.forceResume) {
    return new _resume__WEBPACK_IMPORTED_MODULE_0__.default(options, handlers);
  }
  // 如果大于4MB则分片，否则直传
  return options.file.size > 4 * _utils__WEBPACK_IMPORTED_MODULE_2__.MB
      ? new _resume__WEBPACK_IMPORTED_MODULE_0__.default(options, handlers)
      : new _direct__WEBPACK_IMPORTED_MODULE_1__.default(options, handlers);
}

/***/ }),
/* 2 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => /* binding */ Resume
/* harmony export */ });
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3);
/* harmony import */ var _pool__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(7);
/* harmony import */ var _api__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(5);
/* harmony import */ var _base__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(6);




/** 是否为正整数 */
function isPositiveInteger(n) {
  var re = /^[1-9]\d*$/;
  return re.test(String(n));
}

class Resume extends _base__WEBPACK_IMPORTED_MODULE_2__.default {
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
    const pool = new _pool__WEBPACK_IMPORTED_MODULE_3__.Pool((chunkInfo) => this.uploadChunk(chunkInfo), this.config.concurrentRequestLimit);
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
    // 该方法未异步执行，入栈后，执行下一行
    const result = Promise.all(uploadChunks).then(() => this.updateMkFileProgress(1));

    // 该行代码为result的链式then方法，入微任务队列，执行下一行代码
    // 开始进行上传请求，完成上传后执行清理工作
    result.then(() => {
      // 清除本地上传缓存信息
      _utils__WEBPACK_IMPORTED_MODULE_0__.removeLocalFileInfo(this.getLocalKey());
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
    // 使用已有缓存
    const reuseSaved = () => {
      this.updateChunkProgress(chunk.size, index);
    };
    if (info && !shouldCheckMD5) {
      reuseSaved();
      return;
    }
    // 只有需要md5检查才计算
    if(shouldCheckMD5) {
      const md5 = await _utils__WEBPACK_IMPORTED_MODULE_0__.computeMd5(chunk);
      if (info && md5 === info.md5) {
        reuseSaved();
        return;
      }
    }
    const onProgress = (data) => {
      this.updateChunkProgress(data.loaded, index);
    };
    const formdata = this.getUploadChunkFormData({chunk, index});
    const requestOptions = {
      body: formdata,
      headers: this.config.chunkHeaders,
      onProgress,
      onCreate: (xhr) => this.addXhr(xhr),
      requestIdField: this.config.requestIdField,
    };
    const response = await (0,_api__WEBPACK_IMPORTED_MODULE_1__.uploadChunk)(
      {
        key: this.key,
        options: requestOptions,
        method: this.config.uploadChunkMethod,
        url: this.config.path,
        uploadInfo: this.getUploadInfo(),
        index: chunkInfo.index,
      }
    );
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
    _utils__WEBPACK_IMPORTED_MODULE_0__.setLocalFileInfo(this.getLocalKey(), {
      id: this.uploadId,
      data: this.uploadedList
    });
  }

  /**
   * 上传前文件处理，设置分片信息
   */
  async initBeforeUploadChunks() {
    const localKey = this.getLocalKey();
    // 获取本地标识对象
    const localInfo = _utils__WEBPACK_IMPORTED_MODULE_0__.getLocalFileInfo(localKey);
    // 分片必须和当时使用的 uploadId 配套，所以断点续传需要把本地存储的 uploadId 拿出来
    // 假如没有 localInfo 本地信息并重新获取 uploadId
    if (!localInfo) {
      // 防止本地信息已被破坏，初始化时 clear 一下
      _utils__WEBPACK_IMPORTED_MODULE_0__.removeLocalFileInfo(localKey);
      // 本地信息损坏和移除了，uploadId直接使用生成的缓存key，已上传分片列表数据为空
      this.uploadId = localKey;
      this.uploadedList = [];
    } else {
      // 如果本地已有缓存（断点续传的本地缓存判断），则uploadId为缓存信息的id，已上传分片列表为data
      this.uploadId = localInfo.id;
      this.uploadedList = localInfo.data;
    }
    // 获取文件分片大小
    this.chunks = _utils__WEBPACK_IMPORTED_MODULE_0__.getChunks(this.file, this.config.chunkSize);
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
    return _utils__WEBPACK_IMPORTED_MODULE_0__.createLocalKey(this.file.name, this.key, this.file.size);
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
    const loaded = _utils__WEBPACK_IMPORTED_MODULE_0__.sum(this.loaded.chunks) + this.loaded.mkFileProgress;
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


  getUploadChunkFormData({chunk, index}) {
    const formdata = new FormData();
    if(this.customVars) {
      for (const key in this.customVars) {
        const value = this.customVars[key];
        formdata.append(key, value);
      }
    }
    const fields = this.putExtraFields;
    fields.forEach(field => {
      if(field && this.getPutExtraField(field)) {
        if(field === 'file') {
          formdata.append(this.getPutExtraField(field), chunk);
        }else if(field === 'chunkIndex') {
          formdata.append(this.getPutExtraField(field), index);
        }else{
          formdata.append(this.getPutExtraField(field), this.getPutExtraData(field));
        }
      }
    });
    return formdata;
  }
}

/***/ }),
/* 3 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "MB": () => /* binding */ MB,
/* harmony export */   "getChunks": () => /* binding */ getChunks,
/* harmony export */   "sum": () => /* binding */ sum,
/* harmony export */   "setLocalFileInfo": () => /* binding */ setLocalFileInfo,
/* harmony export */   "createLocalKey": () => /* binding */ createLocalKey,
/* harmony export */   "removeLocalFileInfo": () => /* binding */ removeLocalFileInfo,
/* harmony export */   "getLocalFileInfo": () => /* binding */ getLocalFileInfo,
/* harmony export */   "createXHR": () => /* binding */ createXHR,
/* harmony export */   "computeMd5": () => /* binding */ computeMd5,
/* harmony export */   "readAsArrayBuffer": () => /* binding */ readAsArrayBuffer,
/* harmony export */   "request": () => /* binding */ request,
/* harmony export */   "createObjectURL": () => /* binding */ createObjectURL
/* harmony export */ });
/* harmony import */ var spark_md5__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4);
/* harmony import */ var spark_md5__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(spark_md5__WEBPACK_IMPORTED_MODULE_0__);

const MB = 1024 ** 2;
// 文件分块
function getChunks(file, blockSize) {
  let chunkByteSize = blockSize * MB; // 转换为字节
  // 如果 chunkByteSize 比文件大，则直接取文件的大小
  if (chunkByteSize > file.size) {
    chunkByteSize = file.size;
  } else {
    // 因为最多 10000 chunk，所以如果 chunkSize 不符合则把每片 chunk 大小扩大两倍
    while (file.size > chunkByteSize * 10000) {
      chunkByteSize *= 2;
    }
  }
  const chunks = [];
  const count = Math.ceil(file.size / chunkByteSize);
  for (let i = 0; i < count; i++) {
    // chunk: 一个新的 Blob 对象，它包含了原始 Blob 对象的某一个段的数据。
    const chunk = file.slice(chunkByteSize * i, i === count - 1 ? file.size : chunkByteSize * (i + 1));
    chunks.push(chunk);
  }
  return chunks;
}

function sum(list) {
  return list.reduce((data, loaded) => data + loaded, 0);
}


function setLocalFileInfo(localKey, info) {
  try {
    // 用于浏览器缓存文件分片信息，方便续传
    localStorage.setItem(localKey, JSON.stringify(info));
  } catch (err) {
    if (window.console && window.console.warn) {
      // eslint-disable-next-line no-console
      console.warn('setLocalFileInfo failed');
    }
  }
}

/**
 * 根据文件名称，key和大小，生成文件信息缓存在本地的key字符串
 * @param {*} name 文件名称
 * @param {*} key 文件唯一标识
 * @param {*} size 文件大小
 */
function createLocalKey(name, key, size) {
  const localKey = key == null ? '_' : `_key_${key}_`;
  return `split_upload_file_name_${name}${localKey}size_${size}`;
}

/**
 * 当文件信息无效时，直接移除localStorage中对应的item
 * @param {stirng} localKey 文件缓存key
 */
function removeLocalFileInfo(localKey) {
  try {
    localStorage.removeItem(localKey);
  } catch (err) {
    if (window.console && window.console.warn) {
      // eslint-disable-next-line no-console
      console.warn('removeLocalFileInfo failed');
    }
  }
}

/**
 * 返回通过createLocalKey方法生成的key对应的保存在localStorage中的发序列化（JSON.parse）后的文件信息
 * @param {*} localKey 本地标识key
 */
function getLocalFileInfo(localKey) {
  try {
    const localInfo = localStorage.getItem(localKey);
    return localInfo ? JSON.parse(localInfo) : null;
  } catch (err) {
    if (window.console && window.console.warn) {
      // eslint-disable-next-line no-console
      console.warn('getLocalFileInfo failed');
    }
    return null;
  }
}

function createXHR() {
  if (window.XMLHttpRequest) {
    return new XMLHttpRequest();
  }
  return window.ActiveXObject('Microsoft.XMLHTTP');
}


async function computeMd5(data) {
  const buffer = await readAsArrayBuffer(data);
  const spark = new (spark_md5__WEBPACK_IMPORTED_MODULE_0___default().ArrayBuffer)();
  spark.append(buffer);
  return spark.end();
}


function readAsArrayBuffer(data) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    // evt 类型目前存在问题 https://github.com/Microsoft/TypeScript/issues/4163
    reader.onload = (evt) => {
      if (evt.target) {
        const body = evt.target.result;
        resolve(body);
      } else {
        reject(new Error('progress event target is undefined'));
      }
    };
    reader.onerror = () => {
      reject(new Error('fileReader read failed'));
    };
    reader.readAsArrayBuffer(data);
  });
}

/**
 * 
 * @param {String} url 
 * @param {Object} options {method, onCreate, headers, onProgress, body, requestIdField}
 */
function request(url, options) {
  const requestIdField = options.requestIdField || 'requestId';
  return new Promise((resolve, reject) => {
    const xhr = createXHR();
    xhr.open(options.method, url);
    if (options.onCreate) {
      options.onCreate(xhr);
    }
    if (options.headers) {
      const headers = options.headers;
      Object.keys(headers).forEach(k => {
        xhr.setRequestHeader(k, headers[k]);
      });
    }

    xhr.upload.addEventListener('progress', (evt) => {
      if (evt.lengthComputable && options.onProgress) {
        options.onProgress({
          loaded: evt.loaded,
          total: evt.total
        });
      }
    });

    xhr.onreadystatechange = () => {
      const responseText = xhr.responseText;
      if (xhr.readyState !== 4) {
        return;
      }
      const reqId = xhr.getResponseHeader(requestIdField) || '';
      if (xhr.status !== 200) {
        let message = `xhr request failed, code: ${xhr.status}`;
        if (responseText) {
          message += ` response: ${responseText}`;
        }
        reject({
          code: xhr.status,
          message,
          reqId,
          isRequestError: true
        });
        return;
      }
      try {
        resolve({
          data: JSON.parse(responseText),
          reqId
        });
      } catch (err) {
        reject(err);
      }
    };
    xhr.send(options.body);
  });
}

function createObjectURL(file) {
  const URL = window.URL || window.webkitURL || window.mozURL;
  return URL.createObjectURL(file);
}

/***/ }),
/* 4 */
/***/ ((module) => {

(function (factory) {
    if (true) {
        // Node/CommonJS
        module.exports = factory();
    } else { var glob; }
}(function (undefined) {

    'use strict';

    /*
     * Fastest md5 implementation around (JKM md5).
     * Credits: Joseph Myers
     *
     * @see http://www.myersdaily.org/joseph/javascript/md5-text.html
     * @see http://jsperf.com/md5-shootout/7
     */

    /* this function is much faster,
      so if possible we use it. Some IEs
      are the only ones I know of that
      need the idiotic second function,
      generated by an if clause.  */
    var add32 = function (a, b) {
        return (a + b) & 0xFFFFFFFF;
    },
        hex_chr = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];


    function cmn(q, a, b, x, s, t) {
        a = add32(add32(a, q), add32(x, t));
        return add32((a << s) | (a >>> (32 - s)), b);
    }

    function md5cycle(x, k) {
        var a = x[0],
            b = x[1],
            c = x[2],
            d = x[3];

        a += (b & c | ~b & d) + k[0] - 680876936 | 0;
        a  = (a << 7 | a >>> 25) + b | 0;
        d += (a & b | ~a & c) + k[1] - 389564586 | 0;
        d  = (d << 12 | d >>> 20) + a | 0;
        c += (d & a | ~d & b) + k[2] + 606105819 | 0;
        c  = (c << 17 | c >>> 15) + d | 0;
        b += (c & d | ~c & a) + k[3] - 1044525330 | 0;
        b  = (b << 22 | b >>> 10) + c | 0;
        a += (b & c | ~b & d) + k[4] - 176418897 | 0;
        a  = (a << 7 | a >>> 25) + b | 0;
        d += (a & b | ~a & c) + k[5] + 1200080426 | 0;
        d  = (d << 12 | d >>> 20) + a | 0;
        c += (d & a | ~d & b) + k[6] - 1473231341 | 0;
        c  = (c << 17 | c >>> 15) + d | 0;
        b += (c & d | ~c & a) + k[7] - 45705983 | 0;
        b  = (b << 22 | b >>> 10) + c | 0;
        a += (b & c | ~b & d) + k[8] + 1770035416 | 0;
        a  = (a << 7 | a >>> 25) + b | 0;
        d += (a & b | ~a & c) + k[9] - 1958414417 | 0;
        d  = (d << 12 | d >>> 20) + a | 0;
        c += (d & a | ~d & b) + k[10] - 42063 | 0;
        c  = (c << 17 | c >>> 15) + d | 0;
        b += (c & d | ~c & a) + k[11] - 1990404162 | 0;
        b  = (b << 22 | b >>> 10) + c | 0;
        a += (b & c | ~b & d) + k[12] + 1804603682 | 0;
        a  = (a << 7 | a >>> 25) + b | 0;
        d += (a & b | ~a & c) + k[13] - 40341101 | 0;
        d  = (d << 12 | d >>> 20) + a | 0;
        c += (d & a | ~d & b) + k[14] - 1502002290 | 0;
        c  = (c << 17 | c >>> 15) + d | 0;
        b += (c & d | ~c & a) + k[15] + 1236535329 | 0;
        b  = (b << 22 | b >>> 10) + c | 0;

        a += (b & d | c & ~d) + k[1] - 165796510 | 0;
        a  = (a << 5 | a >>> 27) + b | 0;
        d += (a & c | b & ~c) + k[6] - 1069501632 | 0;
        d  = (d << 9 | d >>> 23) + a | 0;
        c += (d & b | a & ~b) + k[11] + 643717713 | 0;
        c  = (c << 14 | c >>> 18) + d | 0;
        b += (c & a | d & ~a) + k[0] - 373897302 | 0;
        b  = (b << 20 | b >>> 12) + c | 0;
        a += (b & d | c & ~d) + k[5] - 701558691 | 0;
        a  = (a << 5 | a >>> 27) + b | 0;
        d += (a & c | b & ~c) + k[10] + 38016083 | 0;
        d  = (d << 9 | d >>> 23) + a | 0;
        c += (d & b | a & ~b) + k[15] - 660478335 | 0;
        c  = (c << 14 | c >>> 18) + d | 0;
        b += (c & a | d & ~a) + k[4] - 405537848 | 0;
        b  = (b << 20 | b >>> 12) + c | 0;
        a += (b & d | c & ~d) + k[9] + 568446438 | 0;
        a  = (a << 5 | a >>> 27) + b | 0;
        d += (a & c | b & ~c) + k[14] - 1019803690 | 0;
        d  = (d << 9 | d >>> 23) + a | 0;
        c += (d & b | a & ~b) + k[3] - 187363961 | 0;
        c  = (c << 14 | c >>> 18) + d | 0;
        b += (c & a | d & ~a) + k[8] + 1163531501 | 0;
        b  = (b << 20 | b >>> 12) + c | 0;
        a += (b & d | c & ~d) + k[13] - 1444681467 | 0;
        a  = (a << 5 | a >>> 27) + b | 0;
        d += (a & c | b & ~c) + k[2] - 51403784 | 0;
        d  = (d << 9 | d >>> 23) + a | 0;
        c += (d & b | a & ~b) + k[7] + 1735328473 | 0;
        c  = (c << 14 | c >>> 18) + d | 0;
        b += (c & a | d & ~a) + k[12] - 1926607734 | 0;
        b  = (b << 20 | b >>> 12) + c | 0;

        a += (b ^ c ^ d) + k[5] - 378558 | 0;
        a  = (a << 4 | a >>> 28) + b | 0;
        d += (a ^ b ^ c) + k[8] - 2022574463 | 0;
        d  = (d << 11 | d >>> 21) + a | 0;
        c += (d ^ a ^ b) + k[11] + 1839030562 | 0;
        c  = (c << 16 | c >>> 16) + d | 0;
        b += (c ^ d ^ a) + k[14] - 35309556 | 0;
        b  = (b << 23 | b >>> 9) + c | 0;
        a += (b ^ c ^ d) + k[1] - 1530992060 | 0;
        a  = (a << 4 | a >>> 28) + b | 0;
        d += (a ^ b ^ c) + k[4] + 1272893353 | 0;
        d  = (d << 11 | d >>> 21) + a | 0;
        c += (d ^ a ^ b) + k[7] - 155497632 | 0;
        c  = (c << 16 | c >>> 16) + d | 0;
        b += (c ^ d ^ a) + k[10] - 1094730640 | 0;
        b  = (b << 23 | b >>> 9) + c | 0;
        a += (b ^ c ^ d) + k[13] + 681279174 | 0;
        a  = (a << 4 | a >>> 28) + b | 0;
        d += (a ^ b ^ c) + k[0] - 358537222 | 0;
        d  = (d << 11 | d >>> 21) + a | 0;
        c += (d ^ a ^ b) + k[3] - 722521979 | 0;
        c  = (c << 16 | c >>> 16) + d | 0;
        b += (c ^ d ^ a) + k[6] + 76029189 | 0;
        b  = (b << 23 | b >>> 9) + c | 0;
        a += (b ^ c ^ d) + k[9] - 640364487 | 0;
        a  = (a << 4 | a >>> 28) + b | 0;
        d += (a ^ b ^ c) + k[12] - 421815835 | 0;
        d  = (d << 11 | d >>> 21) + a | 0;
        c += (d ^ a ^ b) + k[15] + 530742520 | 0;
        c  = (c << 16 | c >>> 16) + d | 0;
        b += (c ^ d ^ a) + k[2] - 995338651 | 0;
        b  = (b << 23 | b >>> 9) + c | 0;

        a += (c ^ (b | ~d)) + k[0] - 198630844 | 0;
        a  = (a << 6 | a >>> 26) + b | 0;
        d += (b ^ (a | ~c)) + k[7] + 1126891415 | 0;
        d  = (d << 10 | d >>> 22) + a | 0;
        c += (a ^ (d | ~b)) + k[14] - 1416354905 | 0;
        c  = (c << 15 | c >>> 17) + d | 0;
        b += (d ^ (c | ~a)) + k[5] - 57434055 | 0;
        b  = (b << 21 |b >>> 11) + c | 0;
        a += (c ^ (b | ~d)) + k[12] + 1700485571 | 0;
        a  = (a << 6 | a >>> 26) + b | 0;
        d += (b ^ (a | ~c)) + k[3] - 1894986606 | 0;
        d  = (d << 10 | d >>> 22) + a | 0;
        c += (a ^ (d | ~b)) + k[10] - 1051523 | 0;
        c  = (c << 15 | c >>> 17) + d | 0;
        b += (d ^ (c | ~a)) + k[1] - 2054922799 | 0;
        b  = (b << 21 |b >>> 11) + c | 0;
        a += (c ^ (b | ~d)) + k[8] + 1873313359 | 0;
        a  = (a << 6 | a >>> 26) + b | 0;
        d += (b ^ (a | ~c)) + k[15] - 30611744 | 0;
        d  = (d << 10 | d >>> 22) + a | 0;
        c += (a ^ (d | ~b)) + k[6] - 1560198380 | 0;
        c  = (c << 15 | c >>> 17) + d | 0;
        b += (d ^ (c | ~a)) + k[13] + 1309151649 | 0;
        b  = (b << 21 |b >>> 11) + c | 0;
        a += (c ^ (b | ~d)) + k[4] - 145523070 | 0;
        a  = (a << 6 | a >>> 26) + b | 0;
        d += (b ^ (a | ~c)) + k[11] - 1120210379 | 0;
        d  = (d << 10 | d >>> 22) + a | 0;
        c += (a ^ (d | ~b)) + k[2] + 718787259 | 0;
        c  = (c << 15 | c >>> 17) + d | 0;
        b += (d ^ (c | ~a)) + k[9] - 343485551 | 0;
        b  = (b << 21 | b >>> 11) + c | 0;

        x[0] = a + x[0] | 0;
        x[1] = b + x[1] | 0;
        x[2] = c + x[2] | 0;
        x[3] = d + x[3] | 0;
    }

    function md5blk(s) {
        var md5blks = [],
            i; /* Andy King said do it this way. */

        for (i = 0; i < 64; i += 4) {
            md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
        }
        return md5blks;
    }

    function md5blk_array(a) {
        var md5blks = [],
            i; /* Andy King said do it this way. */

        for (i = 0; i < 64; i += 4) {
            md5blks[i >> 2] = a[i] + (a[i + 1] << 8) + (a[i + 2] << 16) + (a[i + 3] << 24);
        }
        return md5blks;
    }

    function md51(s) {
        var n = s.length,
            state = [1732584193, -271733879, -1732584194, 271733878],
            i,
            length,
            tail,
            tmp,
            lo,
            hi;

        for (i = 64; i <= n; i += 64) {
            md5cycle(state, md5blk(s.substring(i - 64, i)));
        }
        s = s.substring(i - 64);
        length = s.length;
        tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (i = 0; i < length; i += 1) {
            tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
        }
        tail[i >> 2] |= 0x80 << ((i % 4) << 3);
        if (i > 55) {
            md5cycle(state, tail);
            for (i = 0; i < 16; i += 1) {
                tail[i] = 0;
            }
        }

        // Beware that the final length might not fit in 32 bits so we take care of that
        tmp = n * 8;
        tmp = tmp.toString(16).match(/(.*?)(.{0,8})$/);
        lo = parseInt(tmp[2], 16);
        hi = parseInt(tmp[1], 16) || 0;

        tail[14] = lo;
        tail[15] = hi;

        md5cycle(state, tail);
        return state;
    }

    function md51_array(a) {
        var n = a.length,
            state = [1732584193, -271733879, -1732584194, 271733878],
            i,
            length,
            tail,
            tmp,
            lo,
            hi;

        for (i = 64; i <= n; i += 64) {
            md5cycle(state, md5blk_array(a.subarray(i - 64, i)));
        }

        // Not sure if it is a bug, however IE10 will always produce a sub array of length 1
        // containing the last element of the parent array if the sub array specified starts
        // beyond the length of the parent array - weird.
        // https://connect.microsoft.com/IE/feedback/details/771452/typed-array-subarray-issue
        a = (i - 64) < n ? a.subarray(i - 64) : new Uint8Array(0);

        length = a.length;
        tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (i = 0; i < length; i += 1) {
            tail[i >> 2] |= a[i] << ((i % 4) << 3);
        }

        tail[i >> 2] |= 0x80 << ((i % 4) << 3);
        if (i > 55) {
            md5cycle(state, tail);
            for (i = 0; i < 16; i += 1) {
                tail[i] = 0;
            }
        }

        // Beware that the final length might not fit in 32 bits so we take care of that
        tmp = n * 8;
        tmp = tmp.toString(16).match(/(.*?)(.{0,8})$/);
        lo = parseInt(tmp[2], 16);
        hi = parseInt(tmp[1], 16) || 0;

        tail[14] = lo;
        tail[15] = hi;

        md5cycle(state, tail);

        return state;
    }

    function rhex(n) {
        var s = '',
            j;
        for (j = 0; j < 4; j += 1) {
            s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F];
        }
        return s;
    }

    function hex(x) {
        var i;
        for (i = 0; i < x.length; i += 1) {
            x[i] = rhex(x[i]);
        }
        return x.join('');
    }

    // In some cases the fast add32 function cannot be used..
    if (hex(md51('hello')) !== '5d41402abc4b2a76b9719d911017c592') {
        add32 = function (x, y) {
            var lsw = (x & 0xFFFF) + (y & 0xFFFF),
                msw = (x >> 16) + (y >> 16) + (lsw >> 16);
            return (msw << 16) | (lsw & 0xFFFF);
        };
    }

    // ---------------------------------------------------

    /**
     * ArrayBuffer slice polyfill.
     *
     * @see https://github.com/ttaubert/node-arraybuffer-slice
     */

    if (typeof ArrayBuffer !== 'undefined' && !ArrayBuffer.prototype.slice) {
        (function () {
            function clamp(val, length) {
                val = (val | 0) || 0;

                if (val < 0) {
                    return Math.max(val + length, 0);
                }

                return Math.min(val, length);
            }

            ArrayBuffer.prototype.slice = function (from, to) {
                var length = this.byteLength,
                    begin = clamp(from, length),
                    end = length,
                    num,
                    target,
                    targetArray,
                    sourceArray;

                if (to !== undefined) {
                    end = clamp(to, length);
                }

                if (begin > end) {
                    return new ArrayBuffer(0);
                }

                num = end - begin;
                target = new ArrayBuffer(num);
                targetArray = new Uint8Array(target);

                sourceArray = new Uint8Array(this, begin, num);
                targetArray.set(sourceArray);

                return target;
            };
        })();
    }

    // ---------------------------------------------------

    /**
     * Helpers.
     */

    function toUtf8(str) {
        if (/[\u0080-\uFFFF]/.test(str)) {
            str = unescape(encodeURIComponent(str));
        }

        return str;
    }

    function utf8Str2ArrayBuffer(str, returnUInt8Array) {
        var length = str.length,
           buff = new ArrayBuffer(length),
           arr = new Uint8Array(buff),
           i;

        for (i = 0; i < length; i += 1) {
            arr[i] = str.charCodeAt(i);
        }

        return returnUInt8Array ? arr : buff;
    }

    function arrayBuffer2Utf8Str(buff) {
        return String.fromCharCode.apply(null, new Uint8Array(buff));
    }

    function concatenateArrayBuffers(first, second, returnUInt8Array) {
        var result = new Uint8Array(first.byteLength + second.byteLength);

        result.set(new Uint8Array(first));
        result.set(new Uint8Array(second), first.byteLength);

        return returnUInt8Array ? result : result.buffer;
    }

    function hexToBinaryString(hex) {
        var bytes = [],
            length = hex.length,
            x;

        for (x = 0; x < length - 1; x += 2) {
            bytes.push(parseInt(hex.substr(x, 2), 16));
        }

        return String.fromCharCode.apply(String, bytes);
    }

    // ---------------------------------------------------

    /**
     * SparkMD5 OOP implementation.
     *
     * Use this class to perform an incremental md5, otherwise use the
     * static methods instead.
     */

    function SparkMD5() {
        // call reset to init the instance
        this.reset();
    }

    /**
     * Appends a string.
     * A conversion will be applied if an utf8 string is detected.
     *
     * @param {String} str The string to be appended
     *
     * @return {SparkMD5} The instance itself
     */
    SparkMD5.prototype.append = function (str) {
        // Converts the string to utf8 bytes if necessary
        // Then append as binary
        this.appendBinary(toUtf8(str));

        return this;
    };

    /**
     * Appends a binary string.
     *
     * @param {String} contents The binary string to be appended
     *
     * @return {SparkMD5} The instance itself
     */
    SparkMD5.prototype.appendBinary = function (contents) {
        this._buff += contents;
        this._length += contents.length;

        var length = this._buff.length,
            i;

        for (i = 64; i <= length; i += 64) {
            md5cycle(this._hash, md5blk(this._buff.substring(i - 64, i)));
        }

        this._buff = this._buff.substring(i - 64);

        return this;
    };

    /**
     * Finishes the incremental computation, reseting the internal state and
     * returning the result.
     *
     * @param {Boolean} raw True to get the raw string, false to get the hex string
     *
     * @return {String} The result
     */
    SparkMD5.prototype.end = function (raw) {
        var buff = this._buff,
            length = buff.length,
            i,
            tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            ret;

        for (i = 0; i < length; i += 1) {
            tail[i >> 2] |= buff.charCodeAt(i) << ((i % 4) << 3);
        }

        this._finish(tail, length);
        ret = hex(this._hash);

        if (raw) {
            ret = hexToBinaryString(ret);
        }

        this.reset();

        return ret;
    };

    /**
     * Resets the internal state of the computation.
     *
     * @return {SparkMD5} The instance itself
     */
    SparkMD5.prototype.reset = function () {
        this._buff = '';
        this._length = 0;
        this._hash = [1732584193, -271733879, -1732584194, 271733878];

        return this;
    };

    /**
     * Gets the internal state of the computation.
     *
     * @return {Object} The state
     */
    SparkMD5.prototype.getState = function () {
        return {
            buff: this._buff,
            length: this._length,
            hash: this._hash.slice()
        };
    };

    /**
     * Gets the internal state of the computation.
     *
     * @param {Object} state The state
     *
     * @return {SparkMD5} The instance itself
     */
    SparkMD5.prototype.setState = function (state) {
        this._buff = state.buff;
        this._length = state.length;
        this._hash = state.hash;

        return this;
    };

    /**
     * Releases memory used by the incremental buffer and other additional
     * resources. If you plan to use the instance again, use reset instead.
     */
    SparkMD5.prototype.destroy = function () {
        delete this._hash;
        delete this._buff;
        delete this._length;
    };

    /**
     * Finish the final calculation based on the tail.
     *
     * @param {Array}  tail   The tail (will be modified)
     * @param {Number} length The length of the remaining buffer
     */
    SparkMD5.prototype._finish = function (tail, length) {
        var i = length,
            tmp,
            lo,
            hi;

        tail[i >> 2] |= 0x80 << ((i % 4) << 3);
        if (i > 55) {
            md5cycle(this._hash, tail);
            for (i = 0; i < 16; i += 1) {
                tail[i] = 0;
            }
        }

        // Do the final computation based on the tail and length
        // Beware that the final length may not fit in 32 bits so we take care of that
        tmp = this._length * 8;
        tmp = tmp.toString(16).match(/(.*?)(.{0,8})$/);
        lo = parseInt(tmp[2], 16);
        hi = parseInt(tmp[1], 16) || 0;

        tail[14] = lo;
        tail[15] = hi;
        md5cycle(this._hash, tail);
    };

    /**
     * Performs the md5 hash on a string.
     * A conversion will be applied if utf8 string is detected.
     *
     * @param {String}  str The string
     * @param {Boolean} [raw] True to get the raw string, false to get the hex string
     *
     * @return {String} The result
     */
    SparkMD5.hash = function (str, raw) {
        // Converts the string to utf8 bytes if necessary
        // Then compute it using the binary function
        return SparkMD5.hashBinary(toUtf8(str), raw);
    };

    /**
     * Performs the md5 hash on a binary string.
     *
     * @param {String}  content The binary string
     * @param {Boolean} [raw]     True to get the raw string, false to get the hex string
     *
     * @return {String} The result
     */
    SparkMD5.hashBinary = function (content, raw) {
        var hash = md51(content),
            ret = hex(hash);

        return raw ? hexToBinaryString(ret) : ret;
    };

    // ---------------------------------------------------

    /**
     * SparkMD5 OOP implementation for array buffers.
     *
     * Use this class to perform an incremental md5 ONLY for array buffers.
     */
    SparkMD5.ArrayBuffer = function () {
        // call reset to init the instance
        this.reset();
    };

    /**
     * Appends an array buffer.
     *
     * @param {ArrayBuffer} arr The array to be appended
     *
     * @return {SparkMD5.ArrayBuffer} The instance itself
     */
    SparkMD5.ArrayBuffer.prototype.append = function (arr) {
        var buff = concatenateArrayBuffers(this._buff.buffer, arr, true),
            length = buff.length,
            i;

        this._length += arr.byteLength;

        for (i = 64; i <= length; i += 64) {
            md5cycle(this._hash, md5blk_array(buff.subarray(i - 64, i)));
        }

        this._buff = (i - 64) < length ? new Uint8Array(buff.buffer.slice(i - 64)) : new Uint8Array(0);

        return this;
    };

    /**
     * Finishes the incremental computation, reseting the internal state and
     * returning the result.
     *
     * @param {Boolean} raw True to get the raw string, false to get the hex string
     *
     * @return {String} The result
     */
    SparkMD5.ArrayBuffer.prototype.end = function (raw) {
        var buff = this._buff,
            length = buff.length,
            tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            i,
            ret;

        for (i = 0; i < length; i += 1) {
            tail[i >> 2] |= buff[i] << ((i % 4) << 3);
        }

        this._finish(tail, length);
        ret = hex(this._hash);

        if (raw) {
            ret = hexToBinaryString(ret);
        }

        this.reset();

        return ret;
    };

    /**
     * Resets the internal state of the computation.
     *
     * @return {SparkMD5.ArrayBuffer} The instance itself
     */
    SparkMD5.ArrayBuffer.prototype.reset = function () {
        this._buff = new Uint8Array(0);
        this._length = 0;
        this._hash = [1732584193, -271733879, -1732584194, 271733878];

        return this;
    };

    /**
     * Gets the internal state of the computation.
     *
     * @return {Object} The state
     */
    SparkMD5.ArrayBuffer.prototype.getState = function () {
        var state = SparkMD5.prototype.getState.call(this);

        // Convert buffer to a string
        state.buff = arrayBuffer2Utf8Str(state.buff);

        return state;
    };

    /**
     * Gets the internal state of the computation.
     *
     * @param {Object} state The state
     *
     * @return {SparkMD5.ArrayBuffer} The instance itself
     */
    SparkMD5.ArrayBuffer.prototype.setState = function (state) {
        // Convert string to buffer
        state.buff = utf8Str2ArrayBuffer(state.buff, true);

        return SparkMD5.prototype.setState.call(this, state);
    };

    SparkMD5.ArrayBuffer.prototype.destroy = SparkMD5.prototype.destroy;

    SparkMD5.ArrayBuffer.prototype._finish = SparkMD5.prototype._finish;

    /**
     * Performs the md5 hash on an array buffer.
     *
     * @param {ArrayBuffer} arr The array buffer
     * @param {Boolean}     [raw] True to get the raw string, false to get the hex one
     *
     * @return {String} The result
     */
    SparkMD5.ArrayBuffer.hash = function (arr, raw) {
        var hash = md51_array(new Uint8Array(arr)),
            ret = hex(hash);

        return raw ? hexToBinaryString(ret) : ret;
    };

    return SparkMD5;
}));


/***/ }),
/* 5 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "uploadChunk": () => /* binding */ uploadChunk,
/* harmony export */   "uploadComplete": () => /* binding */ uploadComplete
/* harmony export */ });
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3);


/**
 * @param key 文件本地缓存key
 * @param index 当前 chunk 的索引
 * @param uploadInfo 上传信息
 * @param options 请求参数
 * @param method 请求方法
 */
function uploadChunk({options, method = 'PUT', url = ''}) {
  // 上传分片
  return _utils__WEBPACK_IMPORTED_MODULE_0__.request(url, Object.assign(Object.assign({}, options), {
    method,
    headers: Object.assign({
      'Content-type': 'multipart/form-data'
    }, options.headers)
  }));
}
/**
 * @param key 目标文件名
 * @param uploadInfo 上传信息
 * @param options 请求参数
 * @param method 请求方法
 */
function uploadComplete({options, method = 'POST', url = ''}) {
  return _utils__WEBPACK_IMPORTED_MODULE_0__.request(url, Object.assign({
    method,
  }, options));
}

/***/ }),
/* 6 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DEFAULT_CHUNK_SIZE": () => /* binding */ DEFAULT_CHUNK_SIZE,
/* harmony export */   "default": () => __WEBPACK_DEFAULT_EXPORT__
/* harmony export */ });
const DEFAULT_CHUNK_SIZE = 4; // 单位 MB
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
    return this.config.chunkSize * 1024**2;
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
    return this.putExtra && this.putExtra.file || '';
  },
  fileName: function() {
    return this.putExtra && this.putExtra.fileName || '';
  },
  fileSize: function() {
    return this.putExtra && this.putExtra.fileSize || '';
  },
  fileKey: function() {
    return this.putExtra && this.putExtra.fileKey || '';
  },
  chunkSize: function() {
    return this.putExtra && this.putExtra.chunkSize || '';
  },
  totalChunksCount: function() {
    return this.putExtra && this.putExtra.totalChunksCount || '';
  },
  chunkIndex: function() {
    return this.putExtra && this.putExtra.chunkIndex || '';
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
    return extrafield && putExtraMethods[field] && putExtraMethods[field].call(this) || '';
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
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Base);

/***/ }),
/* 7 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Pool": () => /* binding */ Pool
/* harmony export */ });
class Pool {
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

/***/ }),
/* 8 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => __WEBPACK_DEFAULT_EXPORT__
/* harmony export */ });
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3);
/* harmony import */ var _base__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(6);



class Direct extends _base__WEBPACK_IMPORTED_MODULE_1__.default {
  // 开始上传文件
  async run() {
    const formData = new FormData();
    if (this.customVars) {
      const customVars = this.customVars;
      Object.keys(customVars).forEach(key => formData.append(key, customVars[key]));
    }
    const result = await (0,_utils__WEBPACK_IMPORTED_MODULE_0__.request)(this.uploadUrl, {
      method: 'POST',
      body: formData,
      onProgress: data => {
        this.updateDirectProgress(data.loaded, data.total);
      },
      onCreate: xhr => this.addXhr(xhr),
      requestIdField: this.config.requestIdField,
    });
    this.finishDirectProgress();
    return result;
  }

  // 更新上传进度
  updateDirectProgress(loaded, total) {
    // 当请求未完成时可能进度会达到100，所以total + 1来防止这种情况出现
    // 返回{loaded, size, percent}
    this.progress = {
      total: this.getProgressInfoItem(loaded, total + 1)
    };
    // 调用onData回调函数
    this.onData(this.progress);
  }

  // 完成上传
  finishDirectProgress() {
    // 在某些浏览器环境下，xhr 的 progress 事件无法被触发，progress 为 null，这里 fake 下
    if (!this.progress) {
      this.progress = {
        total: this.getProgressInfoItem(this.file.size, this.file.size)
      };
      // 调用onData回调函数
      this.onData(this.progress);
      return;
    }
    const {
      total
    } = this.progress;
    this.progress = {
      total: this.getProgressInfoItem(total.loaded + 1, total.size)
    };
    // 调用onData回调函数
    this.onData(this.progress);
  }
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Direct);

/***/ }),
/* 9 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Subscriber": () => /* binding */ Subscriber,
/* harmony export */   "Observable": () => /* binding */ Observable
/* harmony export */ });
/** 表示可清理的资源，比如 Observable 的执行 */
class Subscription {
  constructor() {
      /** 用来标示该 Subscription 是否被取消订阅的标示位 */
      this.closed = false;
  }
  /** 取消 observer 的订阅 */
  unsubscribe() {
      if (this.closed) {
          return;
      }
      this.closed = true;
      if (this._unsubscribe) {
          this._unsubscribe();
      }
  }
  /** 添加一个 tear down 在该 Subscription 的 unsubscribe() 期间调用 */
  add(teardown) {
      this._unsubscribe = teardown;
  }
}
/**
* 实现 Observer 接口并且继承 Subscription 类，Observer 是消费 Observable 值的公有 API
* 所有 Observers 都转化成了 Subscriber，以便提供类似 Subscription 的能力，比如 unsubscribe
*/
class Subscriber extends Subscription {
  constructor(observerOrNext, error, complete) {
      super();
      this.isStopped = false;
      if (observerOrNext && typeof observerOrNext === 'object') {
          this.destination = observerOrNext;
      }
      else {
          this.destination = Object.assign(Object.assign(Object.assign({}, observerOrNext && { next: observerOrNext }), error && { error }), complete && { complete });
      }
  }
  unsubscribe() {
      if (this.closed) {
          return;
      }
      this.isStopped = true;
      super.unsubscribe();
  }
  next(value) {
      if (!this.isStopped && this.destination.next) {
          this.destination.next(value);
      }
  }
  error(err) {
      if (!this.isStopped && this.destination.error) {
          this.isStopped = true;
          this.destination.error(err);
      }
  }
  complete(result) {
      if (!this.isStopped && this.destination.complete) {
          this.isStopped = true;
          this.destination.complete(result);
      }
  }
}
/** 可观察对象，当前的上传事件的集合 */
class Observable {
  constructor(_subscribe) {
      this._subscribe = _subscribe;
  }
  subscribe(observerOrNext, error, complete) {
      const sink = new Subscriber(observerOrNext, error, complete);
      sink.add(this._subscribe(sink));
      return sink;
  }
}

/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		if(__webpack_module_cache__[moduleId]) {
/******/ 			return __webpack_module_cache__[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => module['default'] :
/******/ 				() => module;
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop)
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	// module exports must be returned from runtime so entry inlining is disabled
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })()
;
});
//# sourceMappingURL=upload.js.map