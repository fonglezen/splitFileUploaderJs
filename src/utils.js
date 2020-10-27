import SparkMD5 from 'spark-md5';
export const MB = 1024 ** 2;
// 文件分块
export function getChunks(file, blockSize) {
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

export function sum(list) {
  return list.reduce((data, loaded) => data + loaded, 0);
}


export function setLocalFileInfo(localKey, info) {
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
export function createLocalKey(name, key, size) {
  const localKey = key == null ? '_' : `_key_${key}_`;
  return `split_upload_file_name_${name}${localKey}size_${size}`;
}

/**
 * 当文件信息无效时，直接移除localStorage中对应的item
 * @param {stirng} localKey 文件缓存key
 */
export function removeLocalFileInfo(localKey) {
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
export function getLocalFileInfo(localKey) {
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

export function createXHR() {
  if (window.XMLHttpRequest) {
    return new XMLHttpRequest();
  }
  return window.ActiveXObject('Microsoft.XMLHTTP');
}


export async function computeMd5(data) {
  const buffer = await readAsArrayBuffer(data);
  const spark = new SparkMD5.ArrayBuffer();
  spark.append(buffer);
  return spark.end();
}


export function readAsArrayBuffer(data) {
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
export function request(url, options) {
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

export function createObjectURL(file) {
  const URL = window.URL || window.webkitURL || window.mozURL;
  return URL.createObjectURL(file);
}