import {
  request
} from '../utils';
import Base from './base';

class Direct extends Base {
  // 开始上传文件
  async run() {
    const formData = new FormData();
    // file字段名称需要添加自定义属性名
    formData.append(this.config.fileParamName, this.file);
    if (this.key != null) {
      // 文件标识参数名支持自定义
      formData.append(this.config.keyParamName, this.key);
    }
    if (this.customVars) {
      Object.keys(customVars).forEach(key => formData.append(key, customVars[key]));
    }
    const result = await request(this.uploadUrl, {
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

export default Direct;