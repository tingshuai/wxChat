export default {
  attachInfo () {
    let res = wx.getSystemInfoSync()

    wx.WIN_WIDTH = res.screenWidth
    wx.WIN_HEIGHT = res.screenHeight
    wx.IS_IOS = /ios/i.test(res.system)
    wx.IS_ANDROID = /android/i.test(res.system)
    wx.STATUS_BAR_HEIGHT = res.statusBarHeight
    wx.DEFAULT_HEADER_HEIGHT = 46 // res.screenHeight - res.windowHeight - res.statusBarHeight
    wx.DEFAULT_CONTENT_HEIGHT = res.screenHeight - res.statusBarHeight - wx.DEFAULT_HEADER_HEIGHT
    wx.IS_APP = true

    wx.showAlert = (options) => {
      options.showCancel = false
      wx.showModal(options)
    }

    wx.showConfirm = (options) => {
      wx.showModal(options)
    }
  },
  // 状态提示......
  stateMsg(options={title:"操作成功",icon:"",time:1500}){
    wx.showToast({
      title: options.title,
      icon: options.icon,
      duration: options.time
    })
  },
  closeSocket(app,fun){
      app.globalData.socketTask.close({success(res){
          app.globalData.socketTask.openType = false;
      },fail(res){}});
  },
  socketOnClose(app){
    let that = this;
    app.globalData.socketTask.onClose(()=>{
      let _app = getApp();
      that.closeSocket(_app);
      app.globalData.socketTask.openType = false;
      // that.msgTip({title: '提示',content: "网络连接异常！请检查网络并重新进入小程序",scb(){},ccb(){}})
    })
  },
  // 消息提示....
  msgTip(options={}){
    wx.showModal({
      title: options.title,
      content: options.content,
      success: function(res) {
        if (res.confirm) {
          console.log('确定')
          options.scb();
        } else if (res.cancel) {
          console.log('取消')
          options.ccb();
        }
      }
    })
  },
  // http请求......
  http(options={header:{'content-type': 'application/json'}}){
    this.stateMsg({ title:"加载中...",content:"",icon:"loading",time:20000});      
    wx.request({
      url: `${getApp().globalData.httpHost}/${options.url}`,
      data: options.param,
      method: options.method,
      header: options.header,
      success: function(res) {
        wx.hideToast();
        options.scb(res);
      },
      fail: function(res) {
        wx.hideToast();
        options.fcb(res);
      }
    })
  },
  formatTime( _timer ){
    let _time = new Date( _timer.replace( new RegExp("-","gm"),"/") );
    return `${_time.getFullYear()}-${_time.getUTCMonth() + 1}-${_time.getUTCDate()}`;
  },
  reqGroupList(obj){//请求群列表树
    let that = this;
    this.http({ url:`chat/groups/tree`, method:"get",param:{pageSize:0,openId:obj.openId} ,header:{'content-type': 'application/x-www-form-urlencoded'},scb(res){
      return res.data.data.rows
    }})
  },
  connectSocket(app,resolve){//连接socket.......
    let that = this;
    if( app.globalData.socketTask.openType == false ){
      app.globalData.socketTask = wx.connectSocket({
        url: app.globalData.socketHost + `/websocket/${ app.globalData.openId }`,//用户id
        data:{},
        header:{'content-type': 'application/json'},
        success:function(msg){
          console.log( "SocketTask.readState" , app.globalData.socketTask )
          setTimeout(()=>{
            that.socketOnClose(getApp());
            that.socketOnOpen(getApp());
            that.socketOnError(getApp());
          },1000)
          resolve();
        },
        fail:function(msg){
          that.msgTip({title: '提示',content: "会话连接失败！请检查网络并重新进入小程序",scb(){},ccb(){}})
        }
      })
    }
  },
  socketOnOpen(app){
    app.globalData.socketTask.onOpen(function(res) {
      app.globalData.socketTask.openType = true;
      console.log( 'socket open' );
    })
  },
  socketOnError(app,_tip){
    //监听WebSocket错误。
    let that = this;
    app.globalData.socketTask.onError(function(res){
        system.msgTip({title: '提示',content: _tip,scb(){},ccb(){}})
        that.closeSocket(getApp());
    })
  },
  sendSocketMessage(obj) {//发送socket消息......
      let that = this;
      obj._app.socketTask.send({
        data: obj.params,
        success(res){},
        fail(res){
          that.msgTip({title: '提示',content: "网络连接断开请检查网络，并重新进入小程序.",scb(){},ccb(){}})
        }
      })
  },
  searchUrl(obj={color:blue,str:''}) {
    var reg = /(http:\/\/|https:\/\/)((\w|=|\?|\.|\/|&|-)+)/g;
    //var reg = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    // var reg=/(http(s)?\:\/\/)?(www\.)?(\w+\:\d+)?(\/\w+)+\.(swf|gif|jpg|bmp|jpeg)/gi;
    //var reg=/(http(s)?\:\/\/)?(www\.)?(\w+\:\d+)?(\/\w+)+\.(swf|gif|jpg|bmp|jpeg)/gi;
    // var reg= /(https?|http|ftp|file):\/\/[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|]/g;
    // var reg= /^((ht|f)tps?):\/\/[\w\-]+(\.[\w\-]+)+([\w\-\.,@?^=%&:\/~\+#]*[\w\-\@?^=%&\/~\+#])?$/;
    obj.str = obj.str.replace(reg, `<text style='color:${obj.color}'>$1</text>`); //这里的reg就是上面的正则表达式
    //s = s.replace(reg, "$1$2"); //这里的reg就是上面的正则表达式
    // s = s.match(reg);
    console.log( obj.str )
    return( obj.str )
  }
}
