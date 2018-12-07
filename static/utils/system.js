let thisChatRoom = null;
export default {
  getThis(me){
    thisChatRoom = me;
  },
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
      let that = this;
      app.globalData.socketTask.close();
  },
  socketOnClose(app){
    let that = this;
    app.globalData.socketTask.onClose(()=>{
      setTimeout(()=>{
        that.connectSocket( getApp(), { type:"next" } )
      },200)
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
  connectSocket(app,_obj){//连接socket.......
    let that = this;
      app.globalData.socketTask = wx.connectSocket({
        url: app.globalData.socketHost + `/websocket/${ app.globalData.openId }`,//用户id
        data:{},
        header:{'content-type': 'application/json'},
        success:function(msg){
          wx.nextTick(()=>{
            that.socketOnMessage(getApp());
            that.socketOnClose(getApp());
            that.socketOnOpen(getApp(),()=>{});
            that.socketOnError(getApp());
            thisChatRoom == null ? null : thisChatRoom.onMessage();//断开重连
            if( _obj.type == 'login' ){//如果是第一次登陆来的。。。。
              wx.redirectTo({
                url: '/pages/home/index?actItem=0'
              })
            }else if( _obj.type == 'next' ){
              console.log( "重连" );
            }
          })
        },
        fail:function(msg){
          that.msgTip({title: '提示',content: "会话连接失败！请检查网络并重新进入小程序",scb(){},ccb(){}})
        }
      })
  },
  socketOnOpen(app,callBack){},
  netChange(){
    let that = this;
    wx.onNetworkStatusChange(function(res) {
      if( !res.isConnected ){
        that.stateMsg({ title:"网络连接断开...",content:"",icon:"none",time:2000});   
        that.closeSocket( getApp() );
      }else{
        that.connectSocket( getApp() );
        that.stateMsg({ title:"网络已连接",content:"",icon:"none",time:2000});  
      }
    })    
  },
  socketOnError(app,_tip){
    //监听WebSocket错误。
    let that = this;
    app.globalData.socketTask.onError(function(res){
        that.msgTip({title: '提示',content: _tip,scb(){},ccb(){}});
        that.closeSocket( getApp() );
    })
  },
  socketOnMessage( app , _me ){
    app.globalData.socketTask.onMessage((res)=>{
      var _data = JSON.parse( res.data );
      app.globalData.promise.upDataGroupMsg = new Promise((resolve,reject)=>{
        switch ( _data.cmd ) {
          case 0://有人发消息过来..
              if( _data.msgType == 7 ){//处理@消息....
                _data.content = _data.content.split('(@\`-\`@)').join(" ");
              }
              wx.getStorage({//更新存储的群信息....
                key: _data.groupId,
                success ( _data_ ) {
                  _data_.data.splice( _data_.data.length, 0, _data );
                  wx.setStorageSync( _data.groupId , _data_.data );
                  resolve( { _old_:_data,_new_:_data_.data } );
                }
              })
              break;
          case 2://有群解散..
              break;          
          default:
              break;
        }
      })
    })
  },
  sendSocketMessage(obj) {//发送socket消息......
      let that = this;
      getApp().globalData.socketTask.send({
        data: obj.params,
        success(res){
          obj.callBack() || null;
        },
        fail(res){
          wx.getNetworkType({
            success (res) {
              if( res.networkType == "none" ){
                that.msgTip({title: '提示',content: "发送失败! 网络未连接",scb(){},ccb(){}})
              }else{
                that.msgTip({title: '提示',content: "未知错误.",scb(){},ccb(){}})
              }
            }
          })          
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
    return( obj.str )
  },
  getGroupMsg( app , num ,resolve){//请求群消息.......
    let _groupMsg = app.globalData.groupMsg;
    this.http({ 
      url:`/chat/msg/getGroupMsg`, method:"get",
      param:{
        groupId : _groupMsg.groupId ,//群ID
        pageSize : 10,//一页几条
        pageNum : num,//第几页
        openId: _groupMsg.openId
      },
      header:{'content-type': 'application/x-www-form-urlencoded'},
      scb(res){
        let _resData = res.data.data;
        wx.getStorage({
          key: _groupMsg.groupId,
          success (_data_) {
            let _newData = [..._resData.rows,..._data_.data]
            resolve( _newData );
            wx.setStorage({
              key: _groupMsg.groupId,
              data: _newData
            })
          },
          fail(){
            wx.setStorage({
              key: _groupMsg.groupId,
              data: _resData.rows
            })
            resolve( _resData.rows );
          }
        })
      }
    })
  }
}
