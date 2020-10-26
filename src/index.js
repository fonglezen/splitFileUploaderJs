import createUploadManager from './upload';
import { Observable } from './observable';

/**
 * 返回一个上传Observable对象
 * @param {File} params0.file 需要上传的文件
 * @param {string} params0.key 上传文件的唯一标识
 * @param {object} params0.config 上传配置
 * 
 * config配置：
 * useCdnDomain: true,
 * disableStatisticsReport: false,
 * retryCount: 3,
 * checkByMD5: false,
 * uphost: '',
 * upprotocol: 'https:',
 * forceDirect: false,
 * chunkSize: DEFAULT_CHUNK_SIZE,
 * concurrentRequestLimit: 3
 */
function upload({file, key, config, customVars}) {
  const options = {
    file,
    key,
    config,
    customVars,
  }
  const createManager = (observer) => {
    const manager = createUploadManager(options, {
        onData: (data) => observer.next(data),
        onError: (err) => observer.error(err),
        onComplete: (res) => observer.complete(res)
    });
    manager.putFile();
    return manager.stop.bind(manager);
  };

  return new Observable(createManager);
}

export default upload;