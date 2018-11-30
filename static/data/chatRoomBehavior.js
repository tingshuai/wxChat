module.exports = Behavior({
    behaviors: [],
    properties: {
      myBehaviorProperty: {
        type: String
      }
    },
    data: {
      isShowControlBar:false,//是否显示下面控制栏....
      isShowUserList:false,//是否显示下面用户列表...      
    },
    attached: function(){},
    methods: {
      toggleHeight(){
        debugger;
        this.setData({
          "isShowControlBar": !this.data.isShowControlBar
        })        
      }
    }
  })