import Resume from './resume';
import Direct from './direct';
import { MB } from '../utils';
export * from './base';
export * from './resume';

export default function createUploadManager(options, handlers) {
  // config.forceDirect: 
  // 是否上传全部采用直传方式，为布尔值；为 `true` 时则上传方式全部为直传 form 方式，禁用断点续传，默认 `false`。
  if (options.config && options.config.forceDirect) {
      return new Direct(options, handlers);
  }
  // 如果大于4MB则分片，否则直传
  return options.file.size > 4 * MB
      ? new Resume(options, handlers)
      : new Direct(options, handlers);
}