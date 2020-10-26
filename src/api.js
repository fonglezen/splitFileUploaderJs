import * as utils from './utils';
import {
  urlSafeBase64Encode
} from './base64';

/** 获取上传url */
export async function getUploadUrl(config) {
  const protocol = config.upprotocol;
  if (config.uphost) {
    return `${protocol}//${config.uphost}`;
  }
  return '';
}
/**
 * 生成上传文件的url
 * @param key 目标文件名
 * @param uploadInfo 上传信息
 */
function getBaseUrl(key, uploadInfo) {
  const {
    url,
    id
  } = uploadInfo;
  return `${url}/buckets/${bucket}/objects/${key != null ? urlSafeBase64Encode(key) : '~'}/uploads/${id}`;
}
/**
 * @param key 文件本地缓存key
 * @param index 当前 chunk 的索引
 * @param uploadInfo 上传信息
 * @param options 请求参数
 */
export function uploadChunk(key, index, uploadInfo, options) {
  // 构造上传分片url
  const url = getBaseUrl(key, uploadInfo) + `/${index}`;
  // 上传分片
  return utils.request(url, Object.assign(Object.assign({}, options), {
    method: 'PUT',
    headers: utils.getHeadersForChunkUpload(token)
  }));
}
/**
 * @param key 目标文件名
 * @param uploadInfo 上传信息
 * @param options 请求参数
 */
export function uploadComplete(key, uploadInfo, options) {
  const url = getBaseUrl(key, uploadInfo);
  return utils.request(url, Object.assign({
    method: 'POST',
  }, options));
}