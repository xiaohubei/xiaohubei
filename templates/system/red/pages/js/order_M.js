﻿cb.views.register('ConfirmOrderController', function (controllerName) {
    var view = function (widgets) {
        cb.views.BaseView.call(this, widgets);
    };
    view.prototype = new cb.views.BaseView();
    view.prototype.controllerName = controllerName;
    view.prototype.init = function (views) {
        var self = this;
        var thisView = this.getView();
        var query = this.getViewData();
        var pageData = this.getView()[0].f7PageData.query;

        myApp.hideToolbar('.toolbar.homeNavBar');
        var orderProxy = cb.rest.DynamicProxy.create({
            getOrderMode: {
                url: 'client/Orders/getNewOrder', method: 'GET', options: { token: true, refresh: true, mask: true }
            },
            getExpress: {
                url: 'promotion/PostActivityService/getPostActivityList', method: 'POST', options: { token: true }
            },
            ActivityList: {
                url: 'promotion/PricePreferentialService/getPricePreferentialList', method: 'POST', options: { token: true }
            },
            getCoupons: {
                url: 'coupon/MemberCouponServer/getAvailableCoupon', method: 'POST', options: { token: true }
            },
            submitOrder: {
                url: 'client/Orders/submitOrder', method: 'POST', options: { token: true }
            }
        });
        orderProxy.getOrderMode({}, function (err, result) {
            if (err) {
                if (typeof err == 'string') JSON.parse(err);
                //myApp.toast(err.message, 'error').show(true);
                myApp.mainView.router.back();
                return;
            }
            //用户自定义
            //this.userDefined(result);
            this.result = result;
            var isGiftCard = false;
            cb.cache.set('orderObject', result);
            var giftCart = result.oOrderDetails.filter(function (item) {
                return item.isGiftCard && item.isGiftCard == true;
            });
            if (giftCart.length > 0)
                isGiftCard = true;

            //提交订单数据
            //var commitData = result;
            this.commitData = result;
            thisView.find('.summaryContainer').find('.ProPriceContainer').html('￥' + result.fTotalMoney.toFixed(2));

            //编译  渲染 模板
            //地址信息
            if (!isGiftCard) {
                var addressdata = self.GetInitData(result, 'address');
                if (!cb.cache.get('address')) {
                    if (addressdata) {
                        $$('.confirmOrderContent .addressContent').html(self.render($$('#addrListTpl').html(), { address: addressdata }));
                        cb.cache.set('address', addressdata);
                    }
                    else
                        $$('.confirmOrderContent .addressContent').html(self.render($$('#addrListTpl').html(), { address: null }));
                } else
                    $$('.confirmOrderContent .addressContent').html(self.render($$('#addrListTpl').html(), { address: cb.cache.get('address') }));
            }
            if (result.invoice_enableflag) {
                //发票信息
                var invoicedata = self.GetInitData(result, 'invoice');
                thisView.find('.confirmList-payType .invoiceContent').removeClass('hide');
                if (!cb.cache.get('invoice')) {
                    cb.cache.set('invoice', invoicedata)
                    thisView.find('.confirmList-payType .invoiceContent').html(self.render($$('#invoiceTpl').html(), invoicedata));
                } else
                    thisView.find('.confirmList-payType .invoiceContent').html(self.render($$('#invoiceTpl').html(), cb.cache.get('invoice')));
            }
            else {
                thisView.find('.confirmList-payType .invoiceContent').addClass('hide');
            }

            thisView.find('.confirmList-payType .invoiceContent').on('click', function () {
                var key = $$(this).attr('data-key');
                var data = cb.cache.get(key);
                var link = $$(this).attr('data-link');
                myApp.mainView.router.loadPage({
                    url: link,
                    query: data
                });
            });

            if (!isGiftCard && result.oDeliverTypeList && result.oDeliverTypeList.length) {
                thisView.find('.confirmList-payType .distributionContent').find('.chooseExpressType').html(result.oDeliverTypeList.filter(function (item) {
                    return item.id == 'EMS';
                })[0].name);
                //物流信息
                thisView.find('.confirmList-payType .distributionContent').on('click', function () {
                    myApp.mainView.router.loadPage({
                        url: 'distribution',
                        query: {
                            data: result.oDeliverTypeList,
                            selectedValue: cb.cache.get('ExpressType') ? cb.cache.get('ExpressType') : { id: 'EMS', name: '快递物流' },
                            address: cb.cache.get('address')
                        }
                    });
                });
                thisView.find('.confirmList-payType .storeContent').on('click', function () {
                    myApp.mainView.router.loadPage({
                        url: 'chooseStore',
                        query: {
                            selectedValue: cb.cache.get('ExpressType')
                        }
                    });
                });
            }
            //支付方式
            if (!isGiftCard) {
                thisView.find('.confirmList-payType li[data-datatype="oPayType"]').on('click', function () {
                    if (cb.cache.get('address')) {
                        if (cb.cache.get('address').isCashOnDelivery) {
                            myApp.mainView.router.loadPage({
                                url: 'rebate',
                                query: {
                                    data: result.oPayType,
                                    selectedValue: cb.cache.get('payType') ? cb.cache.get('payType').id : 'FIRSTPAY',
                                    dataType: 'payType'
                                }
                            });
                        }
                        else
                            myApp.toast('该地区仅支持在线支付', 'tips').show(true);
                    }
                });
            }
            //初始化清单
            var productDetailData = {
                detailData: result.oOrderDetails
            };

            var totaliQuantity = 0;
            for (var index = 0; index < result.oOrderDetails.length; index++) {
                totaliQuantity += result.oOrderDetails[index].iQuantity;
            }
            thisView.find('.totalTypeContainer').html(productDetailData.detailData.length + '种' + totaliQuantity + '件');
            thisView.find('.productDetailContainer-title').html('商品清单（' + productDetailData.detailData.length + '）');
            thisView.find('.productDetailContainer').html(self.render($$('#productDetailTpl').html(), productDetailData));

            //计算应付金额
            var dataCollectionFunc = function () {
                var payfor = result.fTotalMoney;
                if (cb.cache.get('active'))
                    payfor -= cb.cache.get('active').cutPrice;

                if (cb.cache.get('coupon')) {
                    if (payfor > cb.cache.get('coupon').maxReduceAmount)
                        payfor -= cb.cache.get('coupon').maxReduceAmount;
                    else
                        payfor = 0;
                }

                if (cb.cache.get('express') && !cb.cache.get('express').isPost) {
                    if (!cb.cache.get('ExpressType') || cb.cache.get('ExpressType').id != 'PICKUP')
                        payfor += cb.cache.get('express').isPostage;
                }

                if (self.commitData.integralOffset)
                    payfor -= self.commitData.integralOffset;
                if (payfor < 0)
                    payfor = (cb.cache.get('express') && !cb.cache.get('express').isPost && (!cb.cache.get('ExpressType') || cb.cache.get('ExpressType').id != 'PICKUP')) ? cb.cache.get('express').isPostage : 0;

                return payfor;
            };

            //汇总信息部分
            $$('div[data-page="confirmOrder"] .summaryContainer').on('valueChange', function () {
                var payfor = dataCollectionFunc();
                thisView.find('.totalPriceContainer').html(payfor.toFixed(2));
            });
            if (!isGiftCard) {
                if (!result.oMemeber.iPoints) result.oMemeber.iPoints = 0;
                //积分抵扣部分
                $$('div[data-page="confirmOrder"] .memberPointerContainer').find('.rebate-balance').html(result.oMemeber.iPoints);
                $$('div[data-page="confirmOrder"] .summaryContainer').children('.pointContainer').show();
                $$('div[data-page="confirmOrder"] .memberPointerContainer').find('input').on('keydown', function (e) {
                    var code = e.keyCode;
                    if ((code <= 57 && code >= 48) || (code <= 105 && code >= 96) || (code == 8)) {
                        return true;
                    } else {
                        return false;
                    }
                });
                $$('div[data-page="confirmOrder"] .memberPointerContainer').find('input').on('keyup change', function (e) {
                    $$(this).val($$(this).val().replace(/[^\d]/g, ''));
                    if (!$$(this).val()) {
                        thisView.find('.summaryContainer #spanTocash').html('￥0.00');
                        $$(this).parent().children('.color-red').html('￥0.00');
                        self.commitData.integralOffset = 0;
                        return;
                    }
                    if (result.oMemeber.iPoints < parseInt($$(this).val())) {
                        myApp.toast('输入的使用积分数超过可用积分，请重新输入', 'tips').show(true);
                        $$(this).val('');
                        thisView.find('.summaryContainer #spanTocash').html('￥0.00');
                        $$(this).parent().children('.color-red').html('￥0.00');
                        self.commitData.integralOffset = 0;
                    }
                    else {
                        var integralOffset = $$(this).val() ? (parseFloat($$(this).val()) / parseFloat(result.pointRule.fOneYuanEquPoints)) * result.pointRule.fOnePointsEquYuan : 0;
                        self.commitData.integralOffset = 0;
                        var valueTotal = dataCollectionFunc();

                        if (integralOffset > valueTotal) {
                            myApp.toast('输入的使用积分数超过订单金额，请重新输入', 'tips').show(true);
                            $$(this).val('');
                            thisView.find('.summaryContainer #spanTocash').html('￥0.00');
                            $$(this).parent().children('.color-red').html('￥0.00');
                        }
                        else {
                            self.commitData.integralOffset = integralOffset;
                            thisView.find('.summaryContainer #spanTocash').html('￥' + integralOffset.toFixed(2));
                            $$(this).parent().children('.color-red').html('￥' + integralOffset.toFixed(2));
                        }
                    }
                    $$('div[data-page="confirmOrder"] .summaryContainer').trigger('valueChange');
                });

                cb.cache.set('express', { isPost: result.isPost, isPostage: result.iPostage });
                thisView.find('.confirmList-rabeta .item-after.expressContainer').html((result.isPost ? '包邮' : '不免邮费'));
                thisView.find('.summaryContainer .sp-expressContainer').html((result.isPost ? '￥0.00' : '￥' + result.iPostage.toFixed(2)));
                //计算运费方法
                thisView.find('.confirmList-rabeta .item-after.expressContainer').on('valueChange', function () {
                    var expressParam = {
                        orderDetail: result.oOrderDetails
                    };
                    expressParam.price = result.fTotalMoney;
                    if (cb.cache.get('active')) {
                        expressParam.price -= cb.cache.get('active').id ? cb.cache.get('active').cutPrice : 0;
                    }
                    expressParam.pricePreferentialProId = cb.cache.get('active') ? cb.cache.get('active').id.toString() : null;
                    expressParam.addressId = cb.cache.get('address') ? cb.cache.get('address').id : null;
                    expressParam.member = result.oMemeber;
                    expressParam.dlyTypeId = result.ideliveryTypeid;
                    expressParam.giftPreferItemId = result.activityIds ? result.activityIds : '';
                    orderProxy.getExpress({ param: expressParam }, function (err, data) {
                        if (err) {
                            //myApp.toast(err.message, 'error').show(true);
                            return;
                        }
                        cb.cache.set('expressInit', { isPost: data.isPost, isPostage: data.postPrice[result.iCorpId] });
                        cb.cache.set('express', { isPost: data.isPost, isPostage: data.postPrice[result.iCorpId] });
                        if (cb.cache.get('ExpressType') && cb.cache.get('ExpressType').id == 'PICKUP') {
                            thisView.find('.confirmList-rabeta .item-after.expressContainer').html('包邮');
                            thisView.find('.summaryContainer .sp-expressContainer').html('￥0.00');
                        }
                        else {
                            thisView.find('.confirmList-rabeta .item-after.expressContainer').html(data.isPost ? '包邮' : '不免邮费');
                            thisView.find('.summaryContainer .sp-expressContainer').html(data.isPost ? '￥0.00' : '￥' + data.postPrice[result.iCorpId].toFixed(2));
                        }
                        thisView.find('.confirmList-rabeta .item-inner.couponListContainer').trigger('valueChange');
                    });
                });

                //加载优惠券
                $$('.confirmList-rabeta .item-inner.couponListContainer').on('valueChange', function () {
                    var container = $$(this);
                    var couponParam = {
                        orderDetail: result.oOrderDetails,
                        promotionAmount: 0,
                        promotionAmountId: 0,
                        pageIndex: 1,
                        pageSize: 1000,
                        giftPreferItemId: result.activityIds ? result.activityIds : ''
                    };
                    var payableAmounts = result.fTotalMoney;
                    if (cb.cache.get('express')) {
                        if (!cb.cache.get('express').isPost) {
                            payableAmounts += cb.cache.get('express').isPostage;
                            couponParam.shippingAmount = cb.cache.get('express').isPostage;
                        }
                        else
                            couponParam.shippingAmount = 0
                    }

                    if (cb.cache.get('active')) {
                        couponParam.promotionAmountId = cb.cache.get('active').id;
                        couponParam.promotionAmount = cb.cache.get('active').cutPrice;
                        payableAmounts -= cb.cache.get('active').cutPrice;
                    }
                    couponParam.payableAmounts = payableAmounts;

                    orderProxy.getCoupons({ param: couponParam }, function (err, data) {
                        if (err) {
                            myApp.toast(err.message, 'error').show(true);
                            return;
                        }
                        container.find('.item-title').html('优惠券(' + data.availableCount + ')');
                        if (data.availableCount)
                            container.children('.item-after').html('请选择');
                        else
                            container.children('.item-after').html('<span style="color:#999;">暂无可用优惠券</span>');

                        cb.cache.set('couponInit', data);
                        cb.cache.set('coupon', null);
                        thisView.find('.summaryContainer .sp-couponContainer').html('￥0.00');

                        $$('div[data-page="confirmOrder"] .summaryContainer').trigger('valueChange');
                    });
                });
                $$('.confirmList-rabeta .item-inner.activityItemContainer').on('valueChange', function () {
                    orderProxy.ActivityList({ orderDetailList: result.oOrderDetails, member: result.oMemeber, giftPreferItemId: result.activityIds ? result.activityIds : '' }, function (aterr, activeData) {
                        if (aterr || !activeData) {
                            myApp.toast('获取优惠信息失败：' + aterr, 'error').show(true);
                            return;
                        }
                        var activeContainer = $$('.confirmList-rabeta .item-inner.activityItemContainer');
                        if (activeData.length > 0) {
                            var activeBest = activeData.filter(function (item) {
                                return item.isBest && item.isBest == true;
                            });
                            if (activeBest.length) {
                                activeContainer.html('<div class="item-title">整单优惠活动（' + activeData.length + '）</div><div class="item-after font-14">已优惠￥' + activeBest[0].cutPrice.toFixed(2) + '元</div>');
                                thisView.find('.summaryContainer .sp-activityItemContainer').html('￥' + activeBest[0].cutPrice.toFixed(2));
                            }
                            else
                                activeContainer.html('<div class="item-title">整单优惠活动（' + activeData.length + '）</div><div class="item-after font-14">请选择</div>');

                            cb.cache.set('active', activeBest[0]);
                            cb.cache.set('activeInitData', activeData);
                        }
                        else {
                            cb.cache.set('activeInitData', []);
                        }
                        //重新计算运费
                        thisView.find('.confirmList-rabeta .item-after.expressContainer').trigger('valueChange');
                    });
                });
                //加载优惠
                $$('.confirmList-rabeta .item-inner.activityItemContainer').trigger('valueChange');

                thisView.find('.confirmList-rabeta').find('li').show();

                thisView.find('.confirmList-rabeta').find('li').on('click', function () {
                    var dataType = $$(this).attr('data-dataType');
                    if (dataType) {
                        switch (dataType) {
                            case "active":
                                myApp.mainView.router.loadPage({
                                    url: 'rebate',
                                    query: {
                                        data: cb.cache.get('activeInitData'),
                                        selectedValue: cb.cache.get('active'),
                                        dataType: 'active'
                                    }
                                });
                                break;
                            case "express":
                                var expressInitData = { isPost: result.isPost, isPostage: result.iPostage };
                                if (cb.cache.get('expressInit'))
                                    expressInitData = cb.cache.get('expressInit');
                                myApp.mainView.router.loadPage({
                                    url: 'rebate',
                                    query: {
                                        data: expressInitData,
                                        selectedValue: cb.cache.get('express'),
                                        dataType: 'express'
                                    }
                                });
                                break;
                            case "coupon":
                                myApp.mainView.router.loadPage({
                                    url: 'coupon',
                                    query: {
                                        data: cb.cache.get('couponInit'),
                                        selectedValue: cb.cache.get('coupon') ? cb.cache.get('coupon') : null,
                                        dataType: 'coupon'
                                    }
                                });
                                break;
                        }
                    }
                });
            }
            else {
                thisView.find('.confirmList-rabeta').find('li').hide();
                $$('div[data-page="confirmOrder"] .summaryContainer').children('.pointContainer').hide();
                $$('div[data-page="confirmOrder"] .summaryContainer').trigger('valueChange');
            }
            thisView.find('.input-orderMsg-container').on('keydown', function (e) {
                var code = e.keyCode;
                if (code != 8 && $$(this).val().length >= 50) {
                    myApp.toast('最多只能输入50个字', 'tips').show(true);
                    $$(this).val($$(this).val().substr(0, 50));
                }
            });
            cb.util.inputKeyboard(thisView);
            thisView.find('.confirmOrderSaveBtn').on('click', function () {
                var commitData = self.commitData;
                /*commitData = self.userDefineData();
                if(!commitData) return;*/
                commitData.iMemeberId = result.oMemeber.id;
                commitData.iSubmiterId = result.oMemeber.id;

                if (!isGiftCard) {
                    if (cb.cache.get('address')) {
                        commitData.iMemeberAddress = cb.cache.get('address').id;
                        commitData.cReceiveAddress = cb.cache.get('address').cAddress;
                        commitData.cReceiver = cb.cache.get('address').cReceiver;
                        commitData.cRegion = cb.cache.get('address').cRegion;
                        commitData.cReceiveMobile = cb.cache.get('address').cMobile;
                        commitData.cReceiveTelePhone = cb.cache.get('address').cTelePhone;
                        commitData.cReceiveZipCode = cb.cache.get('address').cZipCode;
                    }
                    else {
                        myApp.toast('请选择收货地址', 'tips').show(true);
                        return;
                    }

                    if (cb.cache.get('ExpressType')) {
                        commitData.cDeliverType = cb.cache.get('ExpressType').id;
                        if (commitData.cDeliverType == 'PICKUP')
                            commitData.storeId = cb.cache.get('ExpressType').storeId;
                    }
                    else
                        commitData.cDeliverType = 'EMS';

                    if (cb.cache.get('active')) {
                        commitData.preferentialId = cb.cache.get('active').id;
                        commitData.preferentialName = cb.cache.get('active').pName;
                        commitData.preferentialCutPrice = cb.cache.get('active').cutPrice;
                        commitData.preferentialMoney = cb.cache.get('active').cutPrice;
                    }
                    if (cb.cache.get('express'))
                        commitData.isPost = cb.cache.get('express').isPost;
                    if (cb.cache.get('coupon')) {
                        commitData.couponId = cb.cache.get('coupon').couponCoding;
                        commitData.couponName = cb.cache.get('coupon').title;
                        commitData.couponPrice = cb.cache.get('coupon').reduceAmount;
                        commitData.couponTs = cb.cache.get('coupon').couponTs;
                    }
                    commitData.pointNum = $$('div[data-page="confirmOrder"] .memberPointerContainer').find('input').val() ? $$('div[data-page="confirmOrder"] .memberPointerContainer').find('input').val() : 0;
                }
                if (cb.cache.get('invoice')) {
                    commitData.cInvoiceType = cb.cache.get('invoice').cInvoiceType;
                    if (commitData.cInvoiceType != 'NONE') {
                        commitData.cInvoiceContent = cb.cache.get('invoice').cInvoiceContent;
                        commitData.cInvoiceTitle = cb.cache.get('invoice').cInvoiceTitle;
                    }
                }

                if (cb.cache.get('payType') && !isGiftCard)
                    commitData.cPayType = cb.cache.get('payType').id;
                else
                    commitData.cPayType = 'FIRSTPAY';

                commitData.cClientMemo = thisView.find('.input-orderMsg-container').val();
                commitData.promotionCode = cb.rest.AppContext.inviteCode;
                commitData.promoter = cb.rest.AppContext.promotCode;

                myApp.showPreloader('订单提交中，请稍后...');
                orderProxy.submitOrder({ neworder: commitData }, function (err, subResult) {
                    myApp.hidePreloader();
                    if (err) {
                        if (typeof err == 'string')
                            err = JSON.parse(err);
                        myApp.toast(err.message, 'error').show(true);
                        return;
                    }
                    cb.cache.clear();
                    var payTypeName = subResult.cPayType == 'FIRSTPAY' ? "在线支付" : "货到付款";
                    var modalText = '<div class="common-tips-content orderSuccess-tips">' +
                            '<div class="tips-content"><div>订单编号：<span>' + subResult.cOrderNo + '</span></div><div class="sp-money">应付金额：<span>￥' + subResult.fPayMoney + '</span></div><div class="">支付方式：<span>' + payTypeName + '</span></div></div>' +
                            '<div class="tips-manage"><span>您还可以</span></div><div class="button-row">';
                    if (subResult.cPayType == 'FIRSTPAY' && parseFloat(subResult.fPayMoney) > 0)
                        modalText += '<span><i class="icon icon-payfor"></i>去付款</span>';
                    modalText += '<span><i class="icon icon-forOrder"></i>查看订单</span><span><i class="icon icon-goon"></i>随便逛逛</span></div></div>';
                    myApp.modal({
                        title: '<div class="common-tips-title success-tips">' +
                            '<span>订单提交成功！</span>' +
                            '</div>',
                        text: modalText
                    });
                    $$('div.modal .common-tips-content.orderSuccess-tips').find('.button-row').children('span').on('click', function () {
                        myApp.closeModal();

                        var i = $$(this).find("i");
                        if (i.hasClass('icon-payfor')) {
                            myApp.mainView.router.loadPage({
                                url: 'payment',
                                query: {
                                    cOrderNo: subResult.cOrderNo
                                },
                                reload: true
                            });
                        }
                        else if (i.hasClass('icon-forOrder')) {
                            myApp.mainView.router.loadPage({
                                url: 'member/orderdetail?orderId=' + subResult.cOrderNo,
                                reload: true
                            });
                        }
                        else if (i.hasClass('icon-goon')) {
                            // 刷新购物车
                            //myApp.mainView.router.refreshPreviousPage();
                            // 刷新购物车数量
                            update.cartIcon();
                            myApp.mainView.router.loadPage({
                                url: './list',
                                reload: true
                            });
                        }
                    });
                });
            });
        },this);

        //选择项目点击事件
        $$('div[data-page="confirmOrder"] .confirmOrderContent li.addressContent').on('click', function () {
            var key = $$(this).attr('data-key');
            var data = cb.cache.get(key);
            var link = data ? $$(this).attr('data-link') : 'member/addr-new?newAddress=false';
            myApp.mainView.router.loadPage({
                url: link,
                query: data
            });
        });
    }
    view.prototype.userDefined = function (result){ 
        if(!result.oOrderCustomItems) return;   
        for(var i=0; i<result.oOrderCustomItems.length; i++){
            if(result.oOrderCustomItems[i].cFormat){
                result.oOrderCustomItems[i].referenceArr = result.oOrderCustomItems[i].cFormat.split(";")
            }
        };
        var html = this.render($$('#useDefinedTpl').html(), {data:result.oOrderCustomItems})
        this.getView().find('.userDefined').html(html);
        var calendarDefault = myApp.calendar({
            input: '.calendar-default',
            onChange: function(p, values, displayValues){
                p.close()
            }
        });   
    }
    view.prototype.userDefineData = function (){
        var result = this.commitData;
        var userDefineDom = this.getView().find('.userDefined');
        var defineDataDom = userDefineDom.find('.user-defined-data');
        for(var i=0; i<defineDataDom.length; i++){
            for(var j=0; j<result.oOrderCustomItems.length; j++){
                var value = result.oOrderCustomItems[j];
                if($$(defineDataDom[i]).data("cdefinename") == value.cDefineName){
                    var defineData = $$(defineDataDom[i]).val();
                    if(defineData.length > value.iLength){
                        alert(value.cTitle + '长度必须为'+ value.iLength +',请重新输入!');
                        return;
                    }
                    if(defineData.length == 0 && !value.isNull){
                        alert(value.cTitle + "不能为空,请重新输入!");
                        return;
                    }
                    value.cDefaultValue = defineData;
                }
            }
        }
        return result;
    }
    view.prototype.GetInitData = function (val, type) {
        var o = {};
        switch (type) {
            case "address":
                if (!val.oMemeber.memberAddress)
                    return null;
                var defaultAddress = val.oMemeber.memberAddress.filter(function (item) {
                    return item.bDefault == true && item.isForbidden == false;
                });
                if (defaultAddress.length)
                    o = defaultAddress[0];
                else if (val.oMemeber.memberAddress.length > 0) {
                    o = val.oMemeber.memberAddress.filter(function (item) {
                        return item.isForbidden == false;
                    }).length ? val.oMemeber.memberAddress.filter(function (item) {
                        return item.isForbidden == false;
                    })[0] : null;
                }
                if (o)
                    o.select = true;
                break;
            case "baseInfo":
                o.agentName = val.oAgent.cName;
                o.cReceiveContacter = val.cReceiveContacter;
                o.cReceiveContacterPhone = val.cReceiveContacterPhone;
                o.dConfirmDate = val.dConfirmDate;
                o.dSendDate = val.dSendDate;
                break;
            case "payment":
                o.oPayWayCode = val.oPayWayCode.cCode;
                o.oPayWayName = val.oPayWayCode.cName;
                o.oSettlementWayCode = val.oSettlementWay ? val.oSettlementWay.id : '';
                o.oSettlementWayName = val.oSettlementWay ? val.oSettlementWay.cName : '';
                o.oShippingChoiceCode = val.oShippingChoice ? val.oShippingChoice.id : '';
                o.oShippingChoiceName = val.oShippingChoice ? val.oShippingChoice.cName : '';
                break;
            case "invoice":
                o.cInvoiceType = val.cInvoiceType ? val.cInvoiceType : 'NONE';
                o.cInvoiceName = val.cInvoiceType ? "普通发票" : "不开发票";
                o.cInvoiceContent = val.cInvoiceContent;
                o.cInvoiceTitle = val.cInvoiceTitle;
                o.oInvoiceType = val.oInvoiceType;
                o.oInvoiceContent = val.oInvoiceContent;
                break;
        }
        return o;
    };

    view.prototype.afterFromPageBack = function (page) {
        var self = this;
        var fromPageName = page.fromPage.name;
        var query = page.query;

        switch (fromPageName) {
            case "addrList"://监听 地址信息维护
                if (query && query.addressData) {
                    self.getView().find('.confirmOrderContent .addressContent').html(self.render($$('#addrListTpl').html(), { address: query.addressData }));
                    cb.cache.set('address', query.addressData);

                    if (!query.addressData.isCashOnDelivery) {
                        cb.cache.set('payType', { id: 'FIRSTPAY', name: '在线支付' });
                        self.getView().find('.confirmList-payType .choosePayType').html('在线支付');
                    }
                    self.getView().find('.confirmList-rabeta .item-inner.activityItemContainer').trigger('valueChange');
                }
                break;
            case "invoice"://监听 发票信息维护
                if (query && query.invoiceData) {
                    self.getView().find('.confirmList-payType .invoiceContent').html(self.render($$('#invoiceTpl').html(), query.invoiceData));
                    cb.cache.set('invoice', query.invoiceData);
                }
                break;
            case "distribution"://监听 配送方式信息维护
                if (query && query.selectValue) {
                    var expressTypeData = query.selectValue;
                    self.getView().find('.confirmList-payType .distributionContent').find('.chooseExpressType').html(expressTypeData.name);
                    cb.cache.set('ExpressType', expressTypeData);
                    cb.cache.set('storeDetail', null);
                    if (expressTypeData.id != "EMS")
                        self.getView().find('.confirmList-payType .storeContent').removeClass('hide').find('.storeNameContainer').html(expressTypeData.storeName);
                    else
                        self.getView().find('.confirmList-payType .storeContent').addClass('hide');

                    if (cb.cache.get('ExpressType') && cb.cache.get('ExpressType').id == 'PICKUP') {
                        self.getView().find('.confirmList-rabeta .item-after.expressContainer').html('包邮');
                        self.getView().find('.summaryContainer .sp-expressContainer').html('￥0.00');
                    }
                    self.getView().find('.confirmList-rabeta .item-after.expressContainer').trigger('valueChange');
                }
                break;
            case "chooseStore"://监听 自提点信息维护
                if (query && query.storeData) {
                    var storeInfo = query.storeData;
                    self.getView().find('.confirmList-payType .storeContent').find('.storeNameContainer').html(storeInfo.name);
                    var cb_store = cb.cache.get('ExpressType');
                    cb_store.storeId = storeInfo.id;
                    cb_store.storeName = storeInfo.name;
                    cb_store.storeAddress = {
                        province: storeInfo.province,
                        city: storeInfo.city,
                        area: storeInfo.area
                    };
                    cb.cache.set('ExpressType', cb_store);
                }
                break;
            case "rebate": //监听 优惠信息维护
                if (query) {
                    var dataObj = query.data ? query.data : null;
                    var dataType = query.dataType;
                    switch (dataType) {
                        case "active":
                            cb.cache.set('active', dataObj);
                            if (dataObj)
                                self.getView().find('.confirmList-rabeta .item-inner.activityItemContainer').children('.item-after').html('已优惠￥' + dataObj.cutPrice.toFixed(2) + '元');
                            else
                                self.getView().find('.confirmList-rabeta .item-inner.activityItemContainer').children('.item-after').html('请选择');

                            self.getView().find('.summaryContainer .sp-activityItemContainer').html('￥' + (dataObj ? dataObj.cutPrice.toFixed(2) : '0.00'));
                            self.getView().find('.confirmList-rabeta .item-after.expressContainer').trigger('valueChange');
                            break;
                        case "express":
                            cb.cache.set('express', dataObj);
                            if (cb.cache.get('ExpressType') && cb.cache.get('ExpressType').id == 'PICKUP') {
                                self.getView().find('.confirmList-rabeta .item-after.expressContainer').html('包邮');
                                self.getView().find('.summaryContainer .sp-expressContainer').html('￥0.00');
                            }
                            else {
                                self.getView().find('.confirmList-rabeta .item-after.expressContainer').html(dataObj.isPost ? '包邮' : '不免邮费');
                                self.getView().find('.summaryContainer .sp-expressContainer').html(dataObj.isPost ? '￥0.00' : '￥' + dataObj.isPostage.toFixed(2));
                            }
                            self.getView().find('.confirmList-rabeta .item-inner.couponListContainer').trigger('valueChange');
                            self.getView().find('div[data-page="confirmOrder"] .summaryContainer').trigger('valueChange');
                            break;
                        case "payType":
                            if (dataObj.payType) {
                                cb.cache.set('payType', dataObj.payType);
                                self.getView().find('.confirmList-payType .choosePayType').html(dataObj.payType.name);
                            }
                            break;
                    }
                }
                break;
            case "coupon"://监听 优惠信息维护
                if (query) {
                    var dataObj = query.data ? query.data : null;
                    cb.cache.set('coupon', dataObj);
                    if (dataObj) {
                        var couponNmuber = function () {
                            var orderTotal = cb.cache.get('orderObject').fTotalMoney;
                            if (cb.cache.get('active'))
                                orderTotal -= cb.cache.get('active').cutPrice;

                            if (orderTotal >= dataObj.maxReduceAmount)
                                return dataObj.maxReduceAmount;
                            else
                                return orderTotal;
                        };
                        self.getView().find('.confirmList-rabeta .item-inner.couponListContainer').children('.item-after').html('已抵消￥' + couponNmuber().toFixed(2) + '元');
                        self.getView().find('.summaryContainer .sp-couponContainer').html('￥' + couponNmuber().toFixed(2));
                        self.getView().find('div[data-page="confirmOrder"] .memberPointerContainer').find('input').val('');
                        self.getView().find('div[data-page="confirmOrder"] .memberPointerContainer').find('input').trigger('change');
                    }
                    else
                        self.getView().find('.confirmList-rabeta .item-inner.couponListContainer').children('.item-after').html('请选择');

                    self.getView().find('div[data-page="confirmOrder"] .summaryContainer').trigger('valueChange');
                }
                break;
            case "orderdetail":
                //myApp.mainView.router.back();
                break;
            case "payment":
                //myApp.mainView.router.back();
                break;
        }
    };
    return view;
});