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
export class Subscriber extends Subscription {
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
export class Observable {
  constructor(_subscribe) {
      this._subscribe = _subscribe;
  }
  subscribe(observerOrNext, error, complete) {
      const sink = new Subscriber(observerOrNext, error, complete);
      sink.add(this._subscribe(sink));
      return sink;
  }
}