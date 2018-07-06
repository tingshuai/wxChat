
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
  stateMsg(options={title:"操作成功",icon:"success",time:1500}){
    wx.showToast({
      title: options.title,
      icon: options.icon,
      duration: options.time
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
    wx.request({
      url: `${getApp().globalData.httpHost}/${options.url}`,
      data: options.param,
      method: options.method,
      header: options.header,
      success: function(res) {
        options.scb(res);
      },
      fail: function(res) {
        options.fcb(res);
      }
    })
  }
}
