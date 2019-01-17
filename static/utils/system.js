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
    let a = typeof(_timer)
    return new Date( _timer.replace( new RegExp("-","gm"),"/") );
    // return `${_time.getFullYear()}-${_time.getUTCMonth() + 1}-${_time.getUTCDate()}`;
  },
  reqGroupList(obj){//请求群列表树
    let that = this;
    this.http({ url:`chat/groups/tree`, method:"GET",param:{pageSize:0,openId:obj.openId} ,header:{'content-type': 'application/x-www-form-urlencoded'},scb(res){
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
      console.log("收到",_data);
      
      app.globalData.promise.upDataGroupMsg = new Promise((resolve,reject)=>{
        switch ( _data.cmd ) {
          case 0://有人发消息过来..
              that.upDataGroupMsg(_data);
              if( _data.groupId == app.globalData.groupMsg.groupId ){
                that.format({
                  "onMessageData":_data,
                  "resolve":resolve,
                  "isPush":true,
                  callBack(){}
                })
              }
              break;
          case 1:
              that.format({
                "onMessageData":_data,
                "resolve":resolve,
                "isPush":true,
                callBack(){}
              })
              break;              
          case 100://办结评价.....
              that.upDataGroupMsg(_data);
              that.format({
                "onMessageData":_data,
                "resolve":resolve,
                "isPush":true,
                callBack(){}
              })
              break;
          case 20:{//需求....
            that.upDataGroupMsg(_data);
            that.format({
              "onMessageData":_data,
              "resolve":resolve,
              "isPush":true,
              callBack(){}
            })
            break;
          }
          case 3://已读消息提醒
            if( _curPageThis.route == "pages/home/index" ){
              _curPageThis.setGroupList( _data );
            }
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
          case 1000://取消成功..
            that.format({
              "onMessageData":_data,
              "resolve":resolve,
              "isPush":true,
              callBack(){}
            })
            break;
          case 999://到期提醒..
            that.upDataGroupMsg(_data);
            that.format({
              "onMessageData":_data,
              "resolve":resolve,
              "isPush":true,
              callBack(){}
            })            
            break;      
          case 30://取消提醒..
            that.upDataGroupMsg(_data);
            that.format({
              "onMessageData":_data,
              "resolve":resolve,
              "isPush":true,
              callBack(){}
            })            
          break;                                   
          default:
              break;
        }
      })
    })
  },
  upDataGroupMsg(_data){
    console.log("_data",_data);
    let _curPageThis = getApp().globalData._me;
    if( _curPageThis.route == "pages/home/index"){
      _curPageThis.requestGroupList( '/chat/groups/tree','over',2, _data.groupId );
    }     
  },
  sendSocketMessage(obj) {//发送socket消息......
      let that = this;
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
            console.log(res);
            wx.nextTick(()=>{
              that.sendSocketMessage(obj)
            })
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
    let _data_, _cur = null ;
    let _curPageThis = getApp().globalData._me;
    if(obj.history){
      _data_ = obj.onMessageData;
      obj.isPush ? _cur = null : _cur = obj._current;
    }else{
      _data_ = wx.getStorageSync( obj.onMessageData.groupId || getApp().globalData.groupMsg.groupId ) || [];//拿到缓存的群聊数据....
      if( obj.isPush ){
        _data_ = _data_.concat( obj.onMessageData );
      }else{
        _data_ = obj.onMessageData.concat( _data_ );
        _cur = obj.onMessageData.length;
      }
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
        _data_.filter((val)=>{
          if( val.msgId == item.content.disableMsgId ){
            val.content.editable = false
          }
        })
      }else if( item.msgType == 2 ){//语音
        item.voiceState = false;//初始化话筒....
      }else if( item.msgType == 23 ){//撤回...
        if(typeof item.content == "object"){
          return item.content;
        }else{
          item.content = JSON.parse( item.content )
        }
      }else if( item.msgType == 40 || item.msgType == 42 || item.msgType == 41 ){//41编辑42签收
        let type = typeof item.content
        if(typeof item.content != "object"){
          item.content = JSON.parse( item.content );
          item.content.diagramText = JSON.parse( item.content.diagramText );
        }
        if( (item.content.diagramId != "undefined") && !Array.isArray(obj.onMessageData) && (obj.onMessageData.msgType == 42 ||  obj.onMessageData.msgType == 41)){
          obj.onMessageData.content
          if( (item.content.diagramId == obj.onMessageData.content.diagramId) && (item.msgType == 42||item.msgType == 41) ){
            _data_.forEach((it,ii,array)=>{
              if(( it.msgType == 40 || it.msgType == 41 ) && it.msgId != obj.onMessageData.msgId){
                if( obj.onMessageData.msgType == 41 ){
                  it.content.editable = false;
                }else if( obj.onMessageData.msgType == 42 ){
                  it.content.editable = false;
                  it.content.signStatus = true;
                }
              }
            })
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
    if( _curPageThis.route == "pages/groupChat/index" || _curPageThis.route == "pages/historyMsg/index"){//群聊页面......
      if( obj.isPush || obj.isFist ){
        setData();
        if( _curPageThis.route == "pages/groupChat/index" ){
          _curPageThis.selectComponent("#chatTool").setData({//发送成功清空输入框数据....
            "inputVal":"",
            "isInputing":false
          })
        }
        _curPageThis.scrollToBottom();
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
    }else{
      wx.reLaunch({
        url: '/pages/login/index'
      })
    }    
  },
  getHistoryMsg(obj){//请求历史消息.......
    var that= this;
    let _curPageThis = getApp().globalData._me;
    if( obj.pageNumber == 1){
      _curPageThis.setData({
          chatData:[]
      })
    }
    this.http({
        url: `chat/msg/getHisGroupMsg`,
        method:"GET",
        param: obj.onMessageData,
        header:{'content-type': 'application/x-www-form-urlencoded'},
        scb:(res)=>{
            if( res.data.status == 200 ){
              let _isPush;
              let _rows = res.data.data.rows;
              let newData = _rows.concat(_curPageThis.data.chatData);
              obj.pageNumber == 1 ? _isPush = true : _isPush = false;
              that.format({
                "onMessageData":newData,
                "resolve":()=>{},
                "isPush":_isPush,
                "history":true,
                "_current":_curPageThis.data.chatData.length,
                callBack(){
                  wx.hideToast();
                }
              });
            }else{
                wx.hideToast();
                that.stateMsg({title: '提示',content: res.data.message,scb(){},ccb(){}})
            }
        }
    })
  },
  socketHeartBeat(app){
    let that = this;
    app.globalData.socketHeartBeat = setInterval(() => {
      if( app.globalData.socketTask.readyState != 1 && wx.getStorageSync('openId') != "" && wx.getStorageSync('userMsgReq') != ""){
        that.connectSocket(app);
      }
      console.log(app.globalData.socketTask);
    },1000);
  },
  getGroupMsg( app , num ,resolve){//请求群消息.......
    let _groupMsg = app.globalData.groupMsg;
    let that = this;
    this.http({
      url:`/chat/msg/getGroupMsg`, method:"GET",
      param:{
        groupId : _groupMsg.groupId ,//群ID
        pageSize : 10,//一页几条
        pageNum : num,//第几页
        openId: app.globalData.openId
      },
      header:{'content-type': 'application/x-www-form-urlencoded'},
      scb(res){
        let _resData = res.data.data;
        if( num == 1 ){//第一次进来....
          wx.setStorageSync( _groupMsg.groupId , [] );
          that.format({
            "onMessageData":_resData.rows,
            "resolve":resolve,
            "isPush":false,
            "isFist":true,
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
