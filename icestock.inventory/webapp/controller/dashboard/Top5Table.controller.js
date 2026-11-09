sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel"
], (BaseController, JSONModel) => {
  "use strict";

  return BaseController.extend("icestock.inventory.icestock.inventory.controller.dashboard.Top5Table", {
      onInit() { 
        this.getView().setModel(new JSONModel({ "top5Stock": [] }), "top5");
        let oModel = this.getOwnerComponent().getModel("inventory");

        oModel.dataLoaded().then(() => {
                this.makeTop5Data()
            });

            
      },

      makeTop5Data() {
          let oData = this.getOwnerComponent().getModel("inventory").getData();
          let aProducts = oData.products;
          let aSales = oData.sales;
          let aCategories = oData.categories;
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
        
            let vRoute = this.getOwnerComponent().getRouter();
            vRoute.navTo("product");
      }
  });
});
