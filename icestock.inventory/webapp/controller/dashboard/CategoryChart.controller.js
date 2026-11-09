sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel"
], (BaseController, JSONModel) => {
  "use strict";

  return BaseController.extend("icestock.inventory.icestock.inventory.controller.dashboard.CategoryChart", {
      onInit() {
        // 1. 차트에 쓸 빈 모델 만들기 (뷰에서 {chart>/categoryStock} 으로 사용)
            this.getView().setModel(new JSONModel({ categoryStock: [] }), "chart");

            // 2. Component의 원본 모델과 상품·입출고 변경 알림을 가져온다.
            this._oInventoryModel = this.getOwnerComponent().getModel("inventory");
            this._oEventBus = this.getOwnerComponent().getEventBus();

            // 3. 최초 로딩뿐 아니라 등록·수정·입출고 저장 이후에도 다시 집계한다.
            // Product와 StockMovement에서 이미 발행하는 inventory/changed를 구독한다.
            this._oInventoryModel.attachRequestCompleted(this.makeChartData, this);
            this._oEventBus.subscribe("inventory", "changed", this.makeChartData, this);
            // 화면을 늦게 열어 이미 데이터가 로딩된 경우도 바로 표시한다.
            this.makeChartData();

            // 4. 도넛 차트 클릭하면 팝오버 뜨게 연결
            let oPopOver = this.getView().byId("idPopOverE1");
            let oChart = this.getView().byId("idVizFrameE1");
            oPopOver.connect(oChart.getVizUid());
      },

        
      // View가 파괴되면 구독을 해제한다. 다시 생성해도 중복 집계가 발생하지 않는다.
      onExit() {
          this._oInventoryModel.detachRequestCompleted(this.makeChartData, this);
          this._oEventBus.unsubscribe("inventory", "changed", this.makeChartData, this);
      },

      // products를 카테고리별로 재고 합산 → [{ categoryName, stock }, ...]
      makeChartData() {
          // 포장한 순서대로 풀기: 모델 → 데이터
          let oModel = this.getOwnerComponent().getModel("inventory");
          let oData = oModel.getData();

          // JSON 로딩 전에는 빈 배열로 처리하고, 로딩 완료 이벤트에서 다시 계산한다.
          let aProducts = oData.products || [];
          let aCategories = oData.categories || [];
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
              aResult.push({ categoryName: oCategory.categoryName.replace("아이스크림", ""), stock: vSum });
          }

          // 차트 모델에 결과 넣기 → 차트가 자동으로 바뀜
          this.getView().getModel("chart").setProperty("/categoryStock", aResult);
      }
  });
});
