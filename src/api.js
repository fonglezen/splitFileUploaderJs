import * as utils from './utils';

/**
 * @param key 文件本地缓存key
 * @param index 当前 chunk 的索引
 * @param uploadInfo 上传信息
 * @param options 请求参数
 * @param method 请求方法
 */
export function uploadChunk({options, method = 'PUT', url = ''}) {
  // 上传分片
  return utils.request(url, Object.assign(Object.assign({}, options), {
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
export function uploadComplete({options, method = 'POST', url = ''}) {
  return utils.request(url, Object.assign({
    method,
  }, options));
}