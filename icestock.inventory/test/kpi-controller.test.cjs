// KPI 집계 결과와 이벤트 등록·해제를 확인한다. 실제 화면 렌더링 검증은 별도다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function setup(data) {
  let controller;
  let model;
  const bindings = [];
  const inventory = {
    getProperty: (key) => data[key.slice(1)],
    attachRequestCompleted(fn, context) { this.completed = () => fn.call(context); },
    detachRequestCompleted() { this.completed = null; },
    bindList() {
      const binding = {
        attachChange(fn, context) { this.changed = () => fn.call(context); },
        detachChange() { this.changed = null; },
        destroy() { this.destroyed = true; }
      };
      bindings.push(binding);
      return binding;
    }
  };
  class Model {
    constructor(values) { this.data = values; }
    setData(values) { this.data = values; }
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../webapp/controller/dashboard/Kpi.controller.js"), "utf8"), {
    sap: { ui: { define: (deps, factory) => {
      controller = factory({ extend: (name, methods) => methods }, Model);
    } } }
  });
  controller.getView = () => ({ setModel(value) { model = value; }, getModel: () => model });
  controller.getOwnerComponent = () => ({ getModel: () => inventory });
  controller.onInit();
  return { controller, inventory, bindings, getValues: () => model.data };
}

test("활성 상품·안전재고 경계·당월 수량 합계와 연도 필터", () => {
  const { controller } = setup({
    products: [
      { active: true, stock: 5, safetyStock: 5 },
      { active: true, stock: 0, safetyStock: 3 },
      { active: true, stock: 10, safetyStock: 2 },
      { active: false, stock: 100, safetyStock: 200 }
    ],
    movements: [
      { date: "2026-11-01", type: "IN", quantity: 20 },
      { date: "2026-11-30", type: "OUT", quantity: 7 },
      { date: "2026-10-31", type: "IN", quantity: 100 },
      { date: "2025-11-01", type: "OUT", quantity: 100 },
      { date: "2026-12-01", type: "IN", quantity: 100 }
    ]
  });
  const result = controller._calculateKpis(new Date(2026, 10, 9));
  assert.equal(result.productCount, 3);
  assert.equal(result.totalStock, 15);
  assert.equal(result.lowStockCount, 2);
  assert.equal(result.monthlyIn, 20);
  assert.equal(result.monthlyOut, 7);
  assert.equal(result.monthlyTotal, 2);
  assert.equal(controller._calculateKpis(new Date(2027, 0, 1)).monthlyTotal, 0);
});

test("실제 mockData의 2026년 11월 집계", () => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, "../webapp/model/mockData.json"), "utf8"));
  const { controller } = setup(data);
  const result = controller._calculateKpis(new Date(2026, 10, 9));
  assert.equal(result.productCount, 20);
  assert.equal(result.totalStock, 437);
  assert.equal(result.lowStockCount, 8);
  const monthly = data.movements.filter((item) => item.date.startsWith("2026-11-"));
  assert.equal(result.monthlyTotal, monthly.length);
});

test("로딩 전 빈 값·로딩 완료·원본 변경·종료 시 이벤트 정리", () => {
  const data = {};
  const { controller, inventory, bindings, getValues } = setup(data);
  assert.equal(getValues().productCount, 0);
  assert.equal(getValues().monthlyTotal, 0);
  data.products = [{ active: true, stock: 4, safetyStock: 2 }];
  inventory.completed();
  assert.equal(getValues().totalStock, 4);
  data.products[0].stock = 1;
  bindings[0].changed();
  assert.equal(getValues().lowStockCount, 1);
  controller.onExit();
  assert.equal(inventory.completed, null);
  assert.ok(bindings.every((binding) => binding.destroyed && binding.changed === null));
});
