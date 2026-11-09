// 변경 이벤트로 실제 Controller 집계 함수가 재실행되는지 검증한다.
// 화면 렌더링 대신 JSONModel·EventBus 대역을 사용하며 앱 원본 데이터는 바꾸지 않는다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class Model {
  constructor(data = {}) { this.data = data; this.listeners = []; this.writes = 0; }
  getData() { return this.data; }
  getProperty(key) { return key.split("/").filter(Boolean).reduce((value, part) => value?.[part], this.data); }
  setProperty(key, value) {
    const parts = key.split("/").filter(Boolean);
    const last = parts.pop();
    parts.reduce((data, part) => data[part], this.data)[last] = value;
    this.writes++;
  }
  attachRequestCompleted(fn, context) { this.listeners.push({ fn, context }); }
  detachRequestCompleted(fn, context) {
    this.listeners = this.listeners.filter(item => item.fn !== fn || item.context !== context);
  }
  complete() { this.listeners.forEach(item => item.fn.call(item.context)); }
}

function environment(data = {}) {
  const inventory = new Model(data);
  const listeners = [];
  const confirmations = [];
  const bus = {
    subscribe(channel, event, fn, context) { listeners.push({ channel, event, fn, context }); },
    unsubscribe(channel, event, fn, context) {
      const index = listeners.findIndex(item => item.channel === channel && item.event === event && item.fn === fn && item.context === context);
      if (index >= 0) { listeners.splice(index, 1); }
    },
    publish(channel, event) {
      listeners.filter(item => item.channel === channel && item.event === event)
        .forEach(item => item.fn.call(item.context));
    }
  };
  function open(name) {
    let controller;
    const models = {};
    const file = name === "StockMovement" ? name : "dashboard/" + name;
    const dependencies = {
      "sap/ui/core/mvc/Controller": { extend: (namespace, methods) => methods },
      "sap/ui/model/json/JSONModel": Model,
      "sap/m/MessageToast": { show() {} },
      "sap/m/MessageBox": { Action: { OK: "OK", CANCEL: "CANCEL" }, confirm(message, options) { confirmations.push(options.onClose); } }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../webapp/controller/" + file + ".controller.js"), "utf8"), {
      sap: { ui: { define: (deps, factory) => {
        controller = factory(...deps.map(key => dependencies[key]));
      } } }
    });
    controller.getOwnerComponent = () => ({ getModel: () => inventory, getEventBus: () => bus });
    controller.getView = () => ({
      setModel: (model, key) => { models[key] = model; }, getModel: key => models[key],
      byId: () => ({ connect() {}, getVizUid: () => "test-viz" })
    });
    if (name === "StockMovement") {
      // 저장과 이벤트 발행은 실제 메서드를 실행하고 입력 UI만 대역으로 제공한다.
      controller.byId = () => ({
        getValue: () => "테스트", setValue() {},
        getSelectedItem: () => null, setText() {}, setState() {}
      });
    } else {
      controller.onInit();
    }
    return { controller, models };
  }
  return { inventory, bus, listeners, open, confirmations };
}

function fixture() {
  return {
    products: [{ productId: "P001", productName: "메로나", categoryId: "C1", stock: 10 }],
    categories: [{ categoryId: "C1", categoryName: "바 아이스크림" }, { categoryId: "C2", categoryName: "컵 아이스크림" }],
    sales: [{ productId: "P001", quantity: 3 }]
  };
}

test("최초 로딩 전 빈 모델, 로딩 완료 후 집계, 이미 로딩된 상태의 진입", () => {
  const env = environment();
  const category = env.open("CategoryChart");
  const top = env.open("Top5Table");
  assert.equal(category.models.chart.data.categoryStock.length, 0);
  assert.equal(top.models.top5.data.top5Stock.length, 0);
  env.inventory.data = fixture();
  env.inventory.complete();
  assert.equal(category.models.chart.data.categoryStock[0].stock, 10);
  assert.equal(top.models.top5.data.top5Stock[0].quantity, 3);
  const late = env.open("CategoryChart");
  assert.equal(late.models.chart.data.categoryStock[0].stock, 10);
});

test("상품 등록·이름/카테고리 변경·입출고 재고 변경을 같은 이벤트로 반영", () => {
  const env = environment(fixture());
  const category = env.open("CategoryChart");
  const top = env.open("Top5Table");
  env.inventory.data.products.push({ productId: "P002", productName: "새 상품", categoryId: "C2", stock: 0 });
  env.bus.publish("inventory", "changed");
  assert.equal(top.models.top5.data.top5Stock.length, 2);
  env.inventory.data.products[0].stock = 18;
  env.inventory.data.products[0].productName = "변경한 상품명";
  env.inventory.data.products[0].categoryId = "C2";
  env.bus.publish("inventory", "changed");
  assert.equal(category.models.chart.data.categoryStock[0].stock, 0);
  assert.equal(category.models.chart.data.categoryStock[1].stock, 18);
  assert.equal(top.models.top5.data.top5Stock[0].productName, "변경한 상품명");
  assert.equal(top.models.top5.data.top5Stock[0].categoryName, "컵");
  env.inventory.data.products[0].stock = 7;
  env.bus.publish("inventory", "changed");
  assert.equal(category.models.chart.data.categoryStock[1].stock, 7);
});

test("sales 변경 후 누적판매 기준 재정렬, 최대 5개 및 순위 재계산", () => {
  const env = environment(fixture());
  const top = env.open("Top5Table");
  for (let index = 2; index <= 7; index++) {
    env.inventory.data.products.push({ productId: "P00" + index, productName: "상품" + index, categoryId: "C1", stock: 0 });
    env.inventory.data.sales.push({ productId: "P00" + index, quantity: index });
  }
  env.bus.publish("inventory", "changed");
  assert.equal(top.models.top5.data.top5Stock.length, 5);
  assert.equal(top.models.top5.data.top5Stock[0].productName, "상품7");
  assert.equal(top.models.top5.data.top5Stock[0].rank, 1);
  env.inventory.data.sales.push({ productId: "P001", quantity: 20 });
  env.bus.publish("inventory", "changed");
  assert.equal(top.models.top5.data.top5Stock[0].productName, "메로나");
  assert.equal(top.models.top5.data.top5Stock[0].quantity, 23);
});

test("종료 후 이벤트·로딩 콜백 제거, 재생성 후 중복 구독 없음", () => {
  const env = environment();
  const oldCategory = env.open("CategoryChart");
  const oldTop = env.open("Top5Table");
  oldCategory.controller.onExit();
  oldTop.controller.onExit();
  assert.equal(env.listeners.length, 0);
  assert.equal(env.inventory.listeners.length, 0);
  const oldWrites = oldCategory.models.chart.writes + oldTop.models.top5.writes;
  env.inventory.data = fixture();
  env.inventory.complete();
  env.bus.publish("inventory", "changed");
  assert.equal(oldCategory.models.chart.writes + oldTop.models.top5.writes, oldWrites);
  const currentCategory = env.open("CategoryChart");
  const currentTop = env.open("Top5Table");
  assert.equal(env.listeners.length, 2);
  assert.equal(env.inventory.listeners.length, 2);
  const before = currentCategory.models.chart.writes + currentTop.models.top5.writes;
  env.bus.publish("inventory", "changed");
  assert.equal(currentCategory.models.chart.writes + currentTop.models.top5.writes, before + 2);
});

function movementForm(env, type, reason, quantity) {
  const product = env.inventory.data.products[0];
  return {
    oProductContext: { getPath: () => "/products/0" }, oProduct: product,
    iQuantity: quantity, oDate: new Date(2026, 10, 9), sType: type, sReason: reason
  };
}

test("실제 판매 출고 저장 → sales 생성 → 이미 열린 TOP 5 판매수량과 순위 자동 변경", () => {
  const data = fixture();
  Object.assign(data.products[0], { purchasePrice: 400, sellingPrice: 700 });
  data.products.push({ productId: "P002", productName: "다른 상품", categoryId: "C1", stock: 10 });
  data.movements = [];
  data.sales = [{ salesId: "S009", productId: "P002", quantity: 5 }, { salesId: "S010", productId: "P001", quantity: 3 }];
  const env = environment(data);
  const top = env.open("Top5Table");
  const category = env.open("CategoryChart");
  const movement = env.open("StockMovement");
  assert.equal(top.models.top5.data.top5Stock[0].productName, "다른 상품");
  movement.controller._saveMovement(movementForm(env, "OUT", "SALE", 4));
  const sale = env.inventory.data.sales.at(-1);
  assert.equal(sale.salesId, "S011");
  assert.equal(sale.date, "2026-11-09");
  assert.equal(sale.totalAmount, 2800);
  assert.equal(sale.totalCost, 1600);
  assert.equal(sale.profit, 1200);
  assert.equal(env.inventory.data.products[0].stock, 6);
  assert.equal(env.inventory.data.movements.length, 1);
  assert.equal(category.models.chart.data.categoryStock[0].stock, 16);
  // makeTop5Data를 직접 부르지 않아도 실제 저장 함수의 이벤트로 갱신되어야 한다.
  assert.equal(top.models.top5.data.top5Stock[0].productName, "메로나");
  assert.equal(top.models.top5.data.top5Stock[0].quantity, 7);
  movement.controller._saveMovement(movementForm(env, "OUT", "SALE", 1));
  assert.equal(env.inventory.data.sales.at(-1).salesId, "S012");
  assert.equal(top.models.top5.data.top5Stock[0].quantity, 8);
});

test("매입 입고·폐기 출고는 판매 내역을 만들지 않으며 sales가 없어도 최초 판매 가능", () => {
  const data = fixture();
  Object.assign(data.products[0], { purchasePrice: 400, sellingPrice: 700 });
  data.movements = [];
  delete data.sales;
  const env = environment(data);
  const top = env.open("Top5Table");
  const movement = env.open("StockMovement");
  movement.controller._saveMovement(movementForm(env, "IN", "PURCHASE", 5));
  movement.controller._saveMovement(movementForm(env, "OUT", "DISCARD", 2));
  assert.equal(env.inventory.data.sales, undefined);
  assert.equal(top.models.top5.data.top5Stock[0].quantity, 0);
  movement.controller._saveMovement(movementForm(env, "OUT", "SALE", 1));
  assert.equal(env.inventory.data.sales.length, 1);
  assert.equal(env.inventory.data.sales[0].salesId, "S001");
  assert.equal(top.models.top5.data.top5Stock[0].quantity, 1);
});

test("입출고 확인 취소 또는 폼 검증 실패 시 판매·재고·이력 불변", () => {
  const data = fixture();
  data.movements = [];
  const before = JSON.stringify(data);
  const env = environment(data);
  const movement = env.open("StockMovement");
  movement.controller._getRegisterFormData = () => movementForm(env, "OUT", "SALE", 2);
  movement.controller.onRegisterMovement();
  env.confirmations.pop()("CANCEL");
  assert.equal(JSON.stringify(env.inventory.data), before);
  movement.controller._getRegisterFormData = () => null;
  movement.controller.onRegisterMovement();
  assert.equal(JSON.stringify(env.inventory.data), before);
  assert.equal(env.confirmations.length, 0);
});
