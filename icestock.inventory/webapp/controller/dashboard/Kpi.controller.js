/*
 * KPI 흐름: inventory 원본 읽기 → _calculateKpis에서 집계 → kpi 모델 → XML 바인딩
 * 원본 JSON은 Component에서 이미 읽고 있으므로 다시 다운로드하거나 수정하지 않는다.
 */
sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel"
], (Controller, JSONModel) => {
  "use strict";

  return Controller.extend("icestock.inventory.icestock.inventory.controller.dashboard.Kpi", {
    onInit() {
      // 이 View에서만 쓰는 표시 모델이다. 데이터가 도착하기 전에는 0으로 표시한다.
      this.getView().setModel(new JSONModel({
        productCount: 0, totalStock: 0, lowStockCount: 0,
        monthlyTotal: 0, monthlyIn: 0, monthlyOut: 0
      }), "kpi");
      this._inventory = this.getOwnerComponent().getModel("inventory");

      // 최초 JSON 로딩이 늦게 완료되어도 숫자를 다시 계산한다.
      this._inventory.attachRequestCompleted(this._refreshKpis, this);
      // 상품 등록·수정·입출고로 원본 배열이 변경되어도 KPI를 갱신한다.
      // bindList는 데이터 목록의 변경을 관찰하며 원본을 수정하지 않는다.
      this._productBinding = this._inventory.bindList("/products");
      this._movementBinding = this._inventory.bindList("/movements");
      this._productBinding.attachChange(this._refreshKpis, this);
      this._movementBinding.attachChange(this._refreshKpis, this);
      this._refreshKpis();
    },

    // 이벤트와 계산을 분리한다. 이벤트 인자가 계산 날짜로 전달되지 않도록 한다.
    _refreshKpis() {
      const values = this._calculateKpis(new Date());
      this.getView().getModel("kpi").setData(values);
    },

    // today를 인자로 받아 특정 연·월을 기준으로도 계산을 검증할 수 있다.
    _calculateKpis(today) {
      const products = this._inventory.getProperty("/products") || [];
      const movements = this._inventory.getProperty("/movements") || [];
      const activeProducts = products.filter((product) => product.active);
      let totalStock = 0;
      let lowStockCount = 0;
      activeProducts.forEach((product) => {
        totalStock += product.stock;
        // 안전재고와 같아도 부족에 포함한다. 품절 상품도 이 조건에 포함된다.
        if (product.stock <= product.safetyStock) {
          lowStockCount += 1;
        }
      });

      // YYYY-MM을 만들어 올해 이번 달만 고른다. 예: 2026-11
      const month = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0");
      let monthlyTotal = 0;
      let monthlyIn = 0;
      let monthlyOut = 0;
      movements.forEach((movement) => {
        if (typeof movement.date !== "string" || !movement.date.startsWith(month + "-")) {
          return;
        }
        // 과거 이력은 현재 상품의 활성 여부와 관계없이 포함한다.
        if (movement.type === "IN") {
          monthlyTotal += 1;
          monthlyIn += movement.quantity;
        } else if (movement.type === "OUT") {
          monthlyTotal += 1;
          monthlyOut += movement.quantity;
        }
      });
      return {
        productCount: activeProducts.length,
        totalStock, lowStockCount,
        monthlyTotal,
        monthlyIn, monthlyOut
      };
    },

    onExit() {
      // View 종료 후에도 이벤트가 남아 중복 계산하지 않도록 정리한다.
      this._inventory.detachRequestCompleted(this._refreshKpis, this);
      this._productBinding.detachChange(this._refreshKpis, this);
      this._movementBinding.detachChange(this._refreshKpis, this);
      this._productBinding.destroy();
      this._movementBinding.destroy();
    }
  });
});
