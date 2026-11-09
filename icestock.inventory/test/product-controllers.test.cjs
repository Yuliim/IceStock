// UI 컨트롤 없이 Controller의 데이터 처리와 저장 규칙을 확인한다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

// 실제 UI5 대신 테스트에 필요한 JSONModel 기능만 흉내 낸다.
// 브라우저 렌더링 검사가 아니라 Controller의 데이터 처리 검증을 위한 준비다.
class Model {
  constructor(data = {}) { this.data = data; }
  getData() { return this.data; }
  setData(data) { this.data = data; }
  dataLoaded() { return Promise.resolve(); }
  setSizeLimit() {}
  attachRequestCompleted() {}
  detachRequestCompleted() {}
  getProperty(key) {
    return key.split("/").filter(Boolean).reduce((value, part) => value?.[part], this.data);
  }
  setProperty(key, value) {
    const parts = key.split("/").filter(Boolean);
    const last = parts.pop();
    const parent = parts.reduce((data, part) => data[part], this.data);
    parent[last] = value;
  }
}

// Controller를 별도 실행 공간(vm)에 읽고 모델·라우터·안내창을 테스트용으로 연결한다.
// data를 전달하지 않으면 실제 mockData.json의 복사본을 사용하여 파일 원본은 바뀌지 않는다.
function setup(file, data) {
  const inventory = new Model(data || JSON.parse(fs.readFileSync(path.join(__dirname, "../webapp/model/mockData.json"), "utf8")));
  const models = {};
  const warnings = [];
  const routes = [];
  const eventListeners = [];
  const eventBus = {
    subscribe: (channel, event, listener, context) => eventListeners.push({ channel, event, listener, context }),
    unsubscribe: (channel, event, listener, context) => {
      const index = eventListeners.findIndex((item) => item.channel === channel && item.event === event && item.listener === listener && item.context === context);
      if (index >= 0) { eventListeners.splice(index, 1); }
    },
    publish: (channel, event, ...args) => eventListeners
      .filter((item) => item.channel === channel && item.event === event)
      .forEach((item) => item.listener.apply(item.context, args))
  };
  const box = {
    warning: (message) => warnings.push(message), information() {},
    Action: { OK: "OK" }, confirm: (message, options) => options.onClose("OK")
  };
  let controller;
  // sap.ui.define의 의존성 자리에 테스트 대역을 넣어 실제 Controller 함수를 얻는다.
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../webapp/controller/" + file + ".controller.js"), "utf8"), {
    sap: { ui: { define: (deps, factory) => {
      controller = factory({ extend: (name, methods) => methods }, Model, {}, box, { show() {} });
    } } }
  });
  controller.getView = () => ({ setModel: (model, name) => { models[name] = model; }, getModel: (name) => models[name] });
  controller.getOwnerComponent = () => ({ getModel: () => inventory, getEventBus: () => eventBus, getRouter: () => ({
    getRoute: () => ({ attachPatternMatched() {}, detachPatternMatched() {} }),
    navTo: (...args) => routes.push(args)
  }) });
  controller.onInit();
  controller.onCloseDialog = () => {};
  return { controller, inventory, models, warnings, routes, eventBus };
}

// UI에서 상품 행의 버튼을 누른 것처럼 이벤트의 bindingContext를 만들어 준다.
function eventFor(product) {
  return { getSource: () => ({ getBindingContext: () => ({ getObject: () => product }) }) };
}

test("재고 부족 테이블은 안전재고 미만 상품만 부족 상태로 제공", async () => {
  const data = { products: [
    { productId: "LOW", stock: 4, safetyStock: 5 },
    { productId: "EQUAL", stock: 5, safetyStock: 5 },
    { productId: "ENOUGH", stock: 6, safetyStock: 5 },
    { productId: "MOVEMENT", stock: 8, safetyStock: 5 }
  ], movements: [
    { movementId: "M001", productId: "MOVEMENT", afterStock: 8 }
  ] };
  const { inventory, models, eventBus } = setup("dashboard/LowStockTable", data);
  await new Promise((resolve) => setImmediate(resolve));

  const rows = models.lowStock.getProperty("/products");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].productId, "LOW");
  assert.equal(rows[0].status, "부족");

  inventory.setProperty("/products/1/stock", 4);
  eventBus.publish("inventory", "changed");
  const updatedRows = models.lowStock.getProperty("/products");
  assert.equal(updatedRows.length, 2);
  assert.equal(updatedRows[1].productId, "EQUAL");

  inventory.setProperty("/movements/0/afterStock", 4);
  eventBus.publish("inventory", "changed");
  const movementUpdatedRows = models.lowStock.getProperty("/products");
  assert.equal(movementUpdatedRows.length, 3);
  assert.equal(movementUpdatedRows[2].productId, "MOVEMENT");
  assert.equal(movementUpdatedRows[2].stock, 4);
});

test("재고 부족 테이블 전체 보기는 상품 관리 화면으로 이동", () => {
  const { controller, routes } = setup("dashboard/LowStockTable");
  controller.onShowAllProducts();
  assert.deepEqual(routes, [["product"]]);
});

// 각 test는 setup으로 독립 데이터를 만들고 assert로 기대 결과를 확인한다.
// 실행: 앱 루트에서 node --test test/product-controllers.test.cjs
test("판매량·부족 경계·필요수량 가공 및 필터 조합", () => {
  const { controller, inventory, models } = setup("Product");
  const first = inventory.getProperty("/products/0");
  const expected = inventory.getProperty("/sales").filter((sale) => sale.productId === first.productId)
    .reduce((total, sale) => total + sale.quantity, 0);
  const row = models.product.getProperty("/rows").find((item) => item.productId === first.productId);
  assert.equal(row.soldQuantity, expected);
  assert.equal(row.requiredQuantity, Math.max(first.safetyStock - first.stock, 0));
  assert.equal(first.soldQuantity, undefined, "가공 값이 원본에 추가되지 않는다");
  inventory.setProperty("/products/0/stock", first.safetyStock);
  controller._refreshProducts();
  models.product.setProperty("/query", first.productId.toLowerCase());
  models.product.setProperty("/category", first.categoryId);
  models.product.setProperty("/status", "부족");
  controller.onFilterChange();
  assert.equal(models.product.getProperty("/count"), 1);
  assert.equal(models.product.getProperty("/rows/0/requiredQuantity"), 0);
  models.product.setProperty("/category", "UNKNOWN");
  controller.onFilterChange();
  assert.equal(models.product.getProperty("/count"), 0);
  controller.onResetFilters();
  assert.equal(models.product.getProperty("/count"), models.product.getProperty("/total"));
});

test("판매량 정렬 뒤에도 ID로 상세 이동·수정·비활성화", () => {
  const { controller, inventory, models, routes } = setup("Product");
  models.product.setProperty("/sort", "SALES");
  controller.onFilterChange();
  const rows = models.product.getProperty("/rows");
  assert.ok(rows.every((row, index) => index === 0 || rows[index - 1].soldQuantity >= row.soldQuantity));
  const selected = rows[0];
  controller.onDetail(eventFor(selected));
  assert.equal(routes[0][1].productId, selected.productId);
  controller._openDialog = (data) => models.form.setData(data);
  controller.onEdit(eventFor(selected));
  models.form.setProperty("/productName", "수정 테스트");
  const original = inventory.getProperty("/products").find((item) => item.productId === selected.productId);
  assert.notEqual(original.productName, "수정 테스트", "폼 입력 중 원본 유지");
  original.stock += 5;
  controller.onSave();
  const saved = inventory.getProperty("/products").find((item) => item.productId === selected.productId);
  assert.equal(saved.productName, "수정 테스트");
  assert.equal(saved.stock, original.stock, "저장 시 최신 재고 보존");
  assert.equal(saved.purchasePrice, original.purchasePrice);
  const historyCount = inventory.getProperty("/movements").length;
  controller.onDeactivate(eventFor(selected));
  assert.equal(saved.active, false);
  assert.equal(models.product.getProperty("/rows").some((item) => item.productId === selected.productId), false);
  assert.equal(inventory.getProperty("/movements").length, historyCount);
});

test("등록 검증: 중복·빈 이름·음수·소수 재고 차단 및 정상 등록", () => {
  const { controller, inventory, models, warnings } = setup("Product");
  controller._openDialog = (data) => models.form.setData(data);
  controller.onCreate();
  const form = { ...models.form.getData(), productName: "테스트 상품" };
  const count = inventory.getProperty("/products").length;
  const invalid = [
    { productId: inventory.getProperty("/products/0/productId") },
    { productName: " " }, { purchasePrice: -1 }, { sellingPrice: "" },
    { safetyStock: 1.5 }, { safetyStock: "NaN" }, { categoryId: "UNKNOWN" }
  ];
  invalid.forEach((patch) => {
    models.form.setData({ ...form, ...patch });
    controller.onSave();
    assert.equal(inventory.getProperty("/products").length, count);
  });
  assert.equal(warnings.length, invalid.length);
  models.form.setData(form);
  controller.onSave();
  const created = inventory.getProperty("/products")[count];
  assert.equal(created.stock, 0);
  assert.equal(created.active, true);
  const row = models.product.getProperty("/rows").find((item) => item.productId === created.productId);
  assert.equal(row.soldQuantity, 0);
});

test("상세는 선택 상품만 집계하고, 없는 상품과 판매 없는 상품 처리", () => {
  const { controller, inventory, models } = setup("ProductDetail");
  const id = inventory.getProperty("/products/0/productId");
  controller._onMatched({ getParameter: () => ({ productId: id }) });
  assert.equal(models.detail.getProperty("/found"), true);
  assert.ok(models.detail.getProperty("/history").every((item) => item.productId === id));
  const sales = inventory.getProperty("/sales").filter((item) => item.productId === id);
  assert.equal(models.detail.getProperty("/revenue"), sales.reduce((sum, item) => sum + item.totalAmount, 0));
  inventory.setProperty("/sales", []);
  inventory.setProperty("/products/0/safetyStock", 0);
  controller._loadProduct();
  assert.equal(models.detail.getProperty("/margin"), "0.0%");
  assert.equal(models.detail.getProperty("/stockRate"), "기준 없음");
  controller._onMatched({ getParameter: () => ({ productId: "missing" }) });
  assert.equal(models.detail.getProperty("/found"), false);
});

test("비동기 데이터가 도착하면 직접 진입한 상세를 다시 조회", () => {
  const { controller, inventory, models } = setup("ProductDetail", {});
  controller._onMatched({ getParameter: () => ({ productId: "P100" }) });
  assert.equal(models.detail.getProperty("/found"), false);
  inventory.setData({ products: [{ productId: "P100", stock: 0, safetyStock: 1, purchasePrice: 0, active: false }] });
  controller._loadProduct();
  assert.equal(models.detail.getProperty("/found"), true);
  assert.equal(models.detail.getProperty("/product/active"), false);
  assert.equal(models.detail.getProperty("/history").length, 0);
});
