sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel"
], (BaseController, JSONModel) => {
  "use strict";

  return BaseController.extend("icestock.inventory.icestock.inventory.controller.dashboard.LowStockTable", {
      onInit() {
        // Component가 제공하는 원본 재고 모델과 갱신 이벤트를 가져온다.
        this._oInventoryModel = this.getOwnerComponent().getModel("inventory");
        this._oEventBus = this.getOwnerComponent().getEventBus();

        // 원본 데이터를 직접 바꾸지 않고, 테이블에 보여줄 부족 상품만 별도 모델로 관리한다.
        this._oLowStockModel = new JSONModel({ products: [] });
        this.getView().setModel(this._oLowStockModel, "lowStock");

        // 원본 데이터 로딩이 끝난 뒤 목록을 만들고, 상품/입출고 변경 이벤트를 구독한다.
        this._oInventoryModel.dataLoaded().then(() => {
          this._refreshLowStockProducts();
          this._oEventBus.subscribe("inventory", "changed", this._refreshLowStockProducts, this);
        });
      },

      onExit() {
        // 화면을 벗어날 때 구독을 해제해 불필요한 갱신을 막는다.
        if (this._oEventBus) {
          this._oEventBus.unsubscribe("inventory", "changed", this._refreshLowStockProducts, this);
        }
      },

      onShowAllProducts() {
        this.getOwnerComponent().getRouter().navTo("product");
      },

      _refreshLowStockProducts() {
        // 원본 상품과 입출고 이력을 읽어 상품별 최신 재고를 계산한다.
        const aProducts = this._oInventoryModel.getProperty("/products") || [];
        const aMovements = this._oInventoryModel.getProperty("/movements") || [];
        const oLatestMovementByProduct = {};
        const aLowStockProducts = [];

        // movement ID가 가장 큰 이력을 해당 상품의 최신 입출고 기록으로 선택한다.
        aMovements.forEach((oMovement) => {
          const oLatestMovement = oLatestMovementByProduct[oMovement.productId];
          const iMovementNumber = Number(String(oMovement.movementId).replace("M", ""));
          const iLatestMovementNumber = oLatestMovement
            ? Number(String(oLatestMovement.movementId).replace("M", ""))
            : -1;

          if (iMovementNumber > iLatestMovementNumber) {
            oLatestMovementByProduct[oMovement.productId] = oMovement;
          }
        });

        // 최신 기록의 afterStock(기록이 없으면 상품 stock)이 안전재고 미만인 경우만 담는다.
        aProducts.forEach((oProduct) => {
          const oLatestMovement = oLatestMovementByProduct[oProduct.productId];
          const iStock = oLatestMovement ? oLatestMovement.afterStock : oProduct.stock;

          if (iStock < oProduct.safetyStock) {
            aLowStockProducts.push({ ...oProduct, stock: iStock, status: "부족" });
          }
        });

        // 뷰는 lowStock>/products에 바인딩되어 있어 이 배열을 표시한다.
        this._oLowStockModel.setProperty("/products", aLowStockProducts);
      }
  });
});