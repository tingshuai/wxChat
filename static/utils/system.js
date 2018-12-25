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
  closeSocket(app){
    if( app.globalData.socketTask != "" ){
      app.globalData.socketTask.close();
    }
  },
  socketOnClose(app){
    let that = this;
    app.globalData.socketTask.onClose(()=>{
      console.log( "关闭" );
    })
  },
  // 消息提示....
  msgTip(options={}){
    wx.showModal({
      title: options.title,
      content: options.content,
      success: function(res) {
        if (res.confirm) {
          options.scb();
        } else if (res.cancel) {
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
    return new Date( _timer.replace( new RegExp("-","gm"),"/") );
    // return `${_time.getFullYear()}-${_time.getUTCMonth() + 1}-${_time.getUTCDate()}`;
  },
  reqGroupList(obj){//请求群列表树
    let that = this;
    this.http({ url:`chat/groups/tree`, method:"get",param:{pageSize:0,openId:obj.openId} ,header:{'content-type': 'application/x-www-form-urlencoded'},scb(res){
      return res.data.data.rows
    }})
  },
  connectSocket(app){//连接socket.......
      let that = this;
      console.log("链接socket的openid" , app.globalData.openId );
      this.closeSocket(app);
      wx.nextTick(()=>{
        app.globalData.socketTask = wx.connectSocket({
          url: app.globalData.socketHost + `/websocket/miniapp/${ app.globalData.openId }`,//用户id
          data:{},
          header:{'content-type': 'application/json'},
          success:function(msg){
            wx.nextTick(()=>{
              that.socketOnMessage(app);
              that.socketOnClose(app);
              that.socketOnOpen(app,()=>{});
              that.socketOnError(app);
            })
          },
          fail:function(msg){
            that.msgTip({title: '提示',content: "会话连接失败！请检查网络并重新进入小程序",scb(){},ccb(){}})
          }
        })
      })
  },
  socketOnOpen(app,callBack){},
  netChange(){
    let that = this;
    wx.onNetworkStatusChange((res)=>{
      if( !res.isConnected ){
        that.stateMsg({ title:"网络连接断开...",content:"",icon:"none",time:2000});   
      }else{
        that.stateMsg({ title:"网络已连接",content:"",icon:"none",time:2000});  
      }
    })
  },
  socketOnError(app){
    //监听WebSocket错误。
    let that = this;
    app.globalData.socketTask.onError(function(res){
      that.closeSocket( getApp() );
      console.log("socket链接失败",res);
    })
  },
  socketOnMessage( app , _me ){
    let that = this;
    app.globalData.socketTask.onMessage((res)=>{
      let _curPageThis = getApp().globalData._me;
      var _data = JSON.parse( res.data );
      app.globalData.promise.upDataGroupMsg = new Promise((resolve,reject)=>{
        switch ( _data.cmd ) {
          case 0://有人发消息过来..
              if( _curPageThis.route == "pages/home/index"){
                _curPageThis.requestGroupList( '/chat/groups/tree','over',2, _data.groupId );
              }
              that.format({
                "onMessageData":_data,
                "resolve":resolve,
                "isPush":true,
                callBack(){}
              })
              break;
          case 1://有人发消息过来..
              that.format({
                "onMessageData":_data,
                "resolve":resolve,
                "isPush":true,
                callBack(){}
              })
              break;              
          case 100://办结评价.....
              wx.getStorage({//更新存储的群信息....
                key: _data.groupId,
                success ( _data_ ) {
                  _data_.data.splice( _data_.data.length, 0, _data );
                  wx.setStorageSync( _data.groupId , _data_.data );
                  resolve( { _old_:_data,_new_:_data_.data } );
                }
              })
              break;
          case 20:{//需求....
            that.format({
              "onMessageData":_data,
              "resolve":resolve,
              "isPush":true,
              callBack(){}
            })
            break;
          }
          case 3://已读消息提醒
              wx.getStorage({//更新存储的群信息....
                key: _data.groupId,
                success ( _data_ ) {
                  _data_.data.filter((val)=>{
                    if( val.msgId == _data.msgId ){
                      val.readStatus = 1;
                      val.readCount = _data.readCount;
                      return val;
                    }
                  })
                  wx.setStorageSync( _data.groupId , _data_.data );
                  resolve( { _old_:_data,_new_:_data_.data } );
                }
              })
              break;
          case 2://有群解散..
              if( _curPageThis.route == "pages/home/index" ){
                _curPageThis.setGroupList( _data );
              }else if( _curPageThis.route == "pages/groupChat/index" ){
                if( _data.groupId == app.globalData.groupMsg.groupId ){
                  that.stateMsg({"title":"本群已被群主解散!",icon:"none",time:1000});
                  setTimeout(()=>{
                    wx.navigateBack();
                  },1000)
                }
              }
              break;
          case 1000://有群解散..
            console.log( "cmd:1000" , JSON.stringify(_data) );
            break;                
          default:
              break;
        }
      })
    })
  },
  sendSocketMessage(obj) {//发送socket消息......
      let that = this;
      let _ready = getApp().globalData.socketTask
      let _sendMsg = (_obj)=>{
        getApp().globalData.socketTask.send({data: obj.params})
        console.log("再连");
      }
      let _send = (obj)=>{
        getApp().globalData.socketTask.send({
          data: obj.params,
          success(res){
            obj.callBack() || null;
          },
          fail(res){
            that.connectSocket(getApp());
            setTimeout(()=>{
              _sendMsg(getApp());
            },300)
          }
        })
      }
      wx.getNetworkType({
        success (resNet) {
          if( resNet.networkType == "none" ){
            that.msgTip({title: '提示',content: "发送失败! 网络未连接",scb(){},ccb(){}})
          }else{
            _send(obj);
          }
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
  format(obj){//加入消息队列.....
    var _data_ = wx.getStorageSync( obj.onMessageData.groupId || getApp().globalData.groupMsg.groupId ) || [];//拿到缓存的群聊数据....
    console.log("storage" , obj.onMessageData.groupId || getApp().globalData.groupMsg.groupId , _data_);
    let _cur = null;
    let _curPageThis = getApp().globalData._me;
    if( obj.isPush ){
      _data_ = _data_.concat( obj.onMessageData );
    }else{
      _data_ = obj.onMessageData.concat( _data_ );
      _cur = obj.onMessageData.length;
    }
    _data_.forEach((item,i,arr)=>{
      if( item.msgType == 7 ){//处理@消息....
        item.content = item.content.split('(@\`-\`@)').join(" ");
      }else if( item.msgType == 20 || item.msgType == 21 || item.msgType == 22 ){
        if(typeof item.content == "object"){
          return item.content;
        }else{
          item.content = JSON.parse( item.content )
        }
        item.content.createAt = this.formatTime( item.content.createAt );
        _data_.filter((val)=>{
          if( val.msgId == item.content.disableMsgId ){
            val.content.editable = false
          }
        })
      }else if( item.msgType == 2 ){//语音
        item.voiceState = false;//初始化话筒....
      }else if( item.msgType == 1 ){//撤回...

      }else if( item.msgType == 40 || item.msgType == 42 || item.msgType == 41 ){//41编辑42签收
        if(typeof item.content == "object"){
          return item.content;
        }else{
          item.content = JSON.parse( item.content );
          item.content.createAt = this.formatTime( item.content.createAt );
          item.content.diagramText = JSON.parse( item.content.diagramText );
          if( item.msgType == 42 && item.msgId == obj.onMessageData.msgId ){
            item.content.editable = false;
            debugger;
          }
        }
      }
    })
    obj.callBack() || null;
    let setData = ()=>{
      _curPageThis.setData({
        chatData:_data_
      })
    }
    wx.setStorageSync( obj.onMessageData.groupId || getApp().globalData.groupMsg.groupId , _data_ );
    if( _curPageThis.route == "pages/groupChat/index" ){//群聊页面......
      if( obj.isPush ){
        setData();
        console.log( _curPageThis.data.chatData ,obj.onMessageData);
        console.log("整理数据并更新群聊",obj);
        _curPageThis.scrollToBottom();
        _curPageThis.selectComponent("#chatTool").setData({//发送成功清空输入框数据....
          "inputVal":"",
          "isInputing":false
        })
      }else{
        setData();
        _curPageThis.getThePoint(_cur);
      }
    }
    obj.resolve( _data_ ) || null;
  },
  isLogin(app){
    if( wx.getStorageSync('openId') != "" && wx.getStorageSync('userMsgReq') != "" ){//已登录
      app.globalData.openId = wx.getStorageSync('openId');
      app.globalData.userMsgReq = wx.getStorageSync('userMsgReq');
      // this.connectSocket( app );//连接socket;
      console.log("已登录")
    }else{
      console.log("未登录")
      wx.reLaunch({
        url: '/pages/login/index'
      })
    }    
  },
  socketHeartBeat(app){
    let that = this;
    app.globalData.socketHeartBeat = setInterval(() => {
      if( app.globalData.socketTask.readyState != 1 ){
        that.connectSocket(app);
      }
      console.log(app.globalData.socketTask);
    },1000);
  },
  getGroupMsg( app , num ,resolve){//请求群消息.......
    let _groupMsg = app.globalData.groupMsg;
    let that = this;
    this.http({
      url:`/chat/msg/getGroupMsg`, method:"get",
      param:{
        groupId : _groupMsg.groupId ,//群ID
        pageSize : 10,//一页几条
        pageNum : num,//第几页
        openId: app.globalData.openId
      },
      header:{'content-type': 'application/x-www-form-urlencoded'},
      scb(res){
        console.log("请求到数据",num,_groupMsg,res);
        let _resData = res.data.data;
        if( num == 1 ){//第一次进来....
          wx.setStorageSync( _groupMsg.groupId , [] );
          that.format({
            "onMessageData":_resData.rows,
            "resolve":resolve,
            "isPush":true,
            callBack(){}
          });
        }else{//翻页....
          that.format({
            "onMessageData":_resData.rows,
            "resolve":resolve,
            "isPush":false,
            callBack(num){}
          });
        }
      }
    })
  }
}
