sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel"
], (BaseController, JSONModel) => {
  "use strict";

  return BaseController.extend("icestock.inventory.icestock.inventory.controller.dashboard.Top5Table", {
      onInit() { 
        this.getView().setModel(new JSONModel({ "top5Stock": [] }), "top5");
        this._oInventoryModel = this.getOwnerComponent().getModel("inventory");
        this._oEventBus = this.getOwnerComponent().getEventBus();

        // 최초 JSON 로딩 완료와 상품·입출고 변경 시 최신 원본으로 순위를 다시 계산한다.
        this._oInventoryModel.attachRequestCompleted(this.makeTop5Data, this);
        this._oEventBus.subscribe("inventory", "changed", this.makeTop5Data, this);
        // 이미 로딩된 뒤 화면을 열어도 바로 표시한다.
        this.makeTop5Data();
      },

      // View 종료 시 해제하여 이전 화면의 콜백이 남지 않게 한다.
      onExit() {
          this._oInventoryModel.detachRequestCompleted(this.makeTop5Data, this);
          this._oEventBus.unsubscribe("inventory", "changed", this.makeTop5Data, this);
      },

      makeTop5Data() {
          let oData = this.getOwnerComponent().getModel("inventory").getData();
          // 비동기 로딩 전에도 오류 없이 빈 목록을 만들 수 있게 기본값을 둔다.
          let aProducts = oData.products || [];
          let aSales = oData.sales || [];
          let aCategories = oData.categories || [];
          let aResult = [];
          
          
          // 상품별 판매수량 합산
          for (let oProduct of aProducts) {
            let vSum = 0;
            for (let oSale of aSales) {
                  if (oSale.productId === oProduct.productId) {
                    vSum += Number(oSale.quantity);
                  }
              }
              // 상품의 categoryId로 카테고리 이름 찾기
              let oCategory = aCategories.find(c => c.categoryId === oProduct.categoryId);

              aResult.push({
                  productName: oProduct.productName,
                  categoryName: oCategory ? oCategory.categoryName.replace(" 아이스크림", "") : "",
                  quantity: vSum
              });
            }

            // 많이 팔린 순 정렬 → 상위 5개 + 순위 붙이기
            aResult.sort((a, b) => b.quantity - a.quantity);
            let aTop5 = aResult.slice(0, 5).map((o, i) => ({ ...o, rank: i + 1 }));
            this.getView().getModel("top5").setProperty("/top5Stock", aTop5);
            
      },
      onTop5(){
            const vRoute = this.getOwnerComponent().getRouter();
            vRoute.navTo("product", {
              "?query": {
                sort: "sales"
              }
            });
      }
  });
});
