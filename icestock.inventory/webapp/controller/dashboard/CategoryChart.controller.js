sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel"
], (BaseController, JSONModel) => {
  "use strict";

  return BaseController.extend("icestock.inventory.icestock.inventory.controller.dashboard.CategoryChart", {
      onInit() {
        // 1. 차트에 쓸 빈 모델 만들기 (뷰에서 {chart>/categoryStock} 으로 사용)
            this.getView().setModel(new JSONModel({ categoryStock: [] }), "chart");

            // 2. manifest.json에 선언한 "inventory" 모델 가져오기
            let oModel = this.getOwnerComponent().getModel("inventory");

            // 3. json 파일을 다 읽고 나면 → makeChartData 실행
            oModel.dataLoaded().then(() => {
                this.makeChartData();
            });

            // 4. 도넛 차트 클릭하면 팝오버 뜨게 연결
            let oPopOver = this.getView().byId("idPopOverE1");
            let oChart = this.getView().byId("idVizFrameE1");
            oPopOver.connect(oChart.getVizUid());
      },

        
      // products를 카테고리별로 재고 합산 → [{ categoryName, stock }, ...]
      makeChartData() {
          // 포장한 순서대로 풀기: 모델 → 데이터
          let oModel = this.getOwnerComponent().getModel("inventory");
          let oData = oModel.getData();

          let aProducts = oData.products;
          let aCategories = oData.categories;
          let aResult = [];

          // 카테고리 하나씩 꺼내서
          for (let oCategory of aCategories) {
              let vSum = 0;

              // 상품을 하나씩 보면서, 같은 카테고리면 재고를 더함
              for (let oProduct of aProducts) {
                  if (oProduct.categoryId === oCategory.categoryId) {
                      vSum += Number(oProduct.stock);
                  }
              }

              // 결과 배열에 { 카테고리이름, 재고합계 } 추가
              aResult.push({ categoryName: oCategory.categoryName, stock: vSum });
          }

          // 차트 모델에 결과 넣기 → 차트가 자동으로 바뀜
          this.getView().getModel("chart").setProperty("/categoryStock", aResult);
      }
  });
});
