/* Framework */
import {ViewChild, Component} from '@angular/core';
import {Platform, MenuController, Nav, ToastController, ModalController, Events} from 'ionic-angular';
import {DomSanitizer} from '@angular/platform-browser';

/* Pages */
// import {ListPage} from '../pages/list/list';
import {PostList} from '../pages/post-list/post-list';
import {Iframe} from '../pages/iframe/iframe';
import {TabsPage} from '../pages/tabs/tabs';
// import {MapPage} from '../pages/google-map/google-map';
import {CustomPage} from '../pages/custom-pages/custom-page';
import {LoginModal} from '../pages/login-modal/login-modal';

/* Providers (make sure to add to app.module.ts providers too) */
// import {MenuProvider} from '../providers/menu/menu';
import {AppCamera} from '../providers/camera/app-camera';
// import {Posts} from '../providers/posts/posts';
import {GlobalVars} from '../providers/globalvars/globalvars';
import {AppAds} from '../providers/appads/appads';
import {FbConnect} from '../providers/facebook/facebook';
import {PushService} from '../providers/push/push';
import {AppWoo} from '../providers/appwoo/appwoo';
import {AppData} from '../providers/appdata/appdata';

/* Native */
import {StatusBar, SocialSharing, Device, InAppBrowser, Splashscreen, Push, Dialogs, Network, Keyboard} from 'ionic-native';
import {Storage} from '@ionic/storage';

@Component({
  templateUrl: 'app.html'
})

export class MyApp {
  @ViewChild(Nav) nav: Nav;

  pages: any;
  styles: any;
  apiurl: string;
  login: boolean;
  navparams: any = [];
  tabs: any;
  login_data: any;
  showmenu: boolean = false;
  apptitle: string;
  introshown: any;
  networkState: any;
  bothMenus: boolean = false;
  loginModal: any;
  showLogin: boolean = false;

  constructor(
    private platform: Platform,
    public appCamera: AppCamera,
    private menu: MenuController,
    private globalvars: GlobalVars,
    private appads: AppAds,
    private fbconnect: FbConnect,
    private sanitizer: DomSanitizer,
    private pushService: PushService,
    private appwoo: AppWoo,
    private appdata: AppData,
    public toastCtrl: ToastController,
    public storage: Storage,
    public modalCtrl: ModalController,
    public events: Events
  ) {

    this.initializeApp();

    events.subscribe('user:login', data => {
      this.userLogin(data);
    });

    events.subscribe('user:logout', obj => {
      this.userLogout();
    });

  }

  initializeApp() {
    this.platform.ready().then(() => {
      // Okay, so the platform is ready and our plugins are available.
      // Here you can do any higher level native things you might need.

      this.apiurl = this.globalvars.getApi();
      
      this.fetchData();

      this.doConnectionEvents();

      this.storage.get('user_login').then( data => {
        console.log('user_login', data)
        if(data) {
          this.login_data = data;
        }
      });

      this.attachListeners();
      
      this.maybeDoPush();

      // prevents bug where select done button didn't display
      Keyboard.hideKeyboardAccessoryBar(false);
      // Disable scroll fixes webview displacement, but hides content lower on page. Can't use
      //Keyboard.disableScroll(true);

      // check for API updates on resume and on initial load
      document.addEventListener('resume', () => {
          this.appdata.checkForUpdates( this.apiurl );
      });

      setTimeout( () => {
        this.appdata.checkForUpdates( this.apiurl );
      }, 5000 );

    });

  }

  fetchData() {
    // get our app data, then use it. will return either local data, or get from api
    this.appdata.load(this.apiurl).then( (data: any) => {

      console.log('Got data', data);

      this.afterData(data);

    }).catch( e => {

      // if there's a problem, default to app-data.json
      console.log( 'problem getting appdata, getting local json file', e );

      this.appdata.getData( 'app-data.json' ).then( (data:any) => {
        console.log('Got local data file.');

        this.afterData(data);

      });

    });
  }

  afterData(data) {

    Splashscreen.hide();
    this.loadMenu(data);
    this.loadStyles(data);
    this.maybeDoAds(data);
    this.doStatusBar(data);

    this.apptitle = data.title;

    this.showLogin = ( data.side_menu_login == "on" ) ? true : false;

  }

  loadMenu(data) {

    console.log('loadmenu', data);
    // any menu imported from WP has to use same component. Other pages can be added manually with different components

    // If we have a tab menu, set that up
    if( data.tab_menu.items ) {

      // let e = { 'title': "Custom Page", 'type': 'apppages', 'class': "information-circle", slug: 'custom' };

      // data.tab_menu.items.push( e );

      for( let item of data.tab_menu.items ) {

        // set component, default is Iframe
        var root:Object = Iframe;

        if( item.type === 'apppages' && item.page_type === 'list' ) {
          root = PostList;
        } else if( item.type === 'apppages' ) {
          root = CustomPage;
        }

        // hide the tab if user added class of hide
        item.show = true;
        if( item.extra_classes.indexOf('hide') >= 0 || item.extra_classes.indexOf('loggedin') >= 0 ) {
          item.show = false;
        }

        this.navParamsPush(item, root);

      }

      this.tabs = this.navparams;

      this.nav.setRoot(TabsPage, this.tabs);

    }

    if( data.menus.items ) {

      this.pages = data.menus.items;

      this.showmenu = true;

      // Add pages manually here, can use different components like this...
      // let e = { 'title': "Custom Page", 'component': CustomPage, 'class': "information-circle", 'navparams': { slug: 'custom' } };

      // this.pages.push( e );

      // set the home page to the proper component
      if( this.tabs ) {
        this.pages.unshift( { 'title': data.tab_menu.name, 'url': '', 'component': TabsPage, 'navparams': this.navparams, 'class': 'home', 'extra_classes':'hide' } );
      } else if( !this.tabs && data.menus.items[0].type === 'apppages' ) {
        
        // if it's a list page, use PostList component
        if( data.menus.items[0].page_type === 'list' ) {
          this.nav.setRoot( PostList, data.menus.items[0] );
        } else {
          // otherwise use CustomPage
          this.nav.setRoot( CustomPage, data.menus.items[0] );
        }

      } else {

        // anything else uses Iframe component
        this.nav.setRoot( Iframe, data.menus.items[0] );

      }

    }

    // Only show the intro if there's a slug
    if( data.meta.intro_slug && data.meta.intro_slug != '' )
      this.maybeShowIntro( data.meta.intro_slug );

    if( data.tab_menu.items && data.menus.items ) {
      // we have both menus, use pushPage on sidemenu
      this.bothMenus = true;
    }

  }

  // construct tab items
  navParamsPush( item, root ) {

    this.navparams.push( { 'title': item.title, 'url': item.url, 'root': root, 'icon': item.class, 'slug': item.slug, 'list_route': item.list_route, 'list_display': item.list_display, 'favorites': item.favorites, 'extra_classes': item.extra_classes, 'show' : item.show, 'show_slider': item.show_slider, 'slide_route': item.slide_route, 'type': item.type, 'page_type': item.page_type } );

  }

  // If there is a page called "Intro", show it the first time the app is used
  maybeShowIntro(slug) {

    this.introshown = window.localStorage.getItem('app-intro-shown');

    if( this.introshown === "true" ) 
      return;

    let intro = { 'title': "Introduction", 'component': CustomPage, 'class': "", 'navparams': { 'slug': slug } };

    this.nav.push( CustomPage, intro.navparams );

    window.localStorage.setItem('app-intro-shown', "true" );
  }

  // side menu link. determine which func to use
  menuLink(p) {
    if( this.bothMenus ) {
      this.pushPage(p);
    } else {
      this.openPage(p);
    }
  }

  openPage(page) {

    // close the menu when clicking a link from the menu
    this.menu.close();

    if( page.target === '_blank' ) {
      this.openIab( page.url, page.target, null );
      return;
    }

    if( page.type === 'apppages' && page.page_type === 'list' ) {
      this.nav.setRoot( PostList, page );
    } else if( page.type === 'apppages' ) {
      this.nav.setRoot( CustomPage, page );
    } else if (page.url) {
      this.nav.setRoot(Iframe, page);
    } else {
      this.nav.setRoot(page.component, page.navparams);
    }

  }

  pushPage(page) {

    // close the menu when clicking a link from the menu
    this.menu.close();

    if( page.type === 'apppages' && page.page_type === 'list' ) {
      this.nav.push( PostList, page );
    } else if( page.type === 'apppages' ) {
      this.nav.push( CustomPage, page );
    } else if (page.url) {
      this.nav.push(Iframe, page);
    } else {
      this.nav.push(page.component, page.navparams);
    }

  }

  doStatusBar(data) {

    if( !StatusBar )
      return;

    if( data.meta.light_status_bar == true ) {
      // Light text, for dark backgrounds
      StatusBar.styleLightContent();
    } else {
      // Dark text
      StatusBar.styleDefault();
    }

  }

  doConnectionEvents() {

    this.networkState = Network.connection;

    if( this.networkState === 'none' || this.networkState === 'unknown' ) {
      this.presentToast('You appear to be offline, app functionality may be limited.');
    }

  }

  loadStyles( data ) {

    // console.log( data );

    // kinda hacky, but it works
    let styles = "<style>";

    // toolbar color
    styles += ".toolbar-background-md, .toolbar-background-ios, .tabs-md .tabbar, .tabs-ios .tabbar { background: " + data.meta.design.toolbar_background + " }";

    // toolbar text
    styles += ".toolbar-content, .toolbar-title, .bar-button-default, .toolbar .bar-button-default:hover, .toolbar .segment-button, .toolbar button.activated, .tabs-md .tab-button[aria-selected=true], .tabs-ios .tab-button[aria-selected=true], ion-toolbar .button { color: "  + data.meta.design.toolbar_color + " }";

    // left menu colors
    styles += ".menu-inner .content-md, .menu-inner .content-ios, .menu-inner ion-list .item { color: "  + data.meta.design.left_menu_text + "; background-color: "  + data.meta.design.left_menu_bg + " }";

    // left menu icon color
    styles += "ion-menu .list-md ion-icon, ion-menu .list-ios ion-icon { color: "  + data.meta.design.left_menu_icons + " }";

    // body text and background
    styles += ".ion-page ion-content, .ion-page ion-list .item { color: "  + data.meta.design.text_color + "; background-color: "  + data.meta.design.body_bg + " }";
    styles += "p, .item p { color: "  + data.meta.design.text_color + " }";

    // buttons
    styles += ".button-primary, .menu-login-button { background: " + data.meta.design.button_background + "!important; color: "  + data.meta.design.button_text_color + " }";

    // headings
    styles += "ion-page h1, ion-page h2, ion-page h3, ion-page h4, ion-page h5, ion-page h6, ion-page ion-list .item h2, ion-page ion-list .item h3, ion-page ion-list .item h4 { color: "  + data.meta.design.headings_color + " }";

    // links
    styles += "ion-page ion-content a, ion-page ion-content a:visited { color: "  + data.meta.design.link_color + " }";

    styles += data.meta.design.custom_css;

    // hide menu toggle if no left menu
    if( this.showmenu === false ) {
      styles += 'ion-navbar .bar-button-menutoggle { display: none !important; }';
    }

    styles += "</style>";

    this.styles = this.sanitizer.bypassSecurityTrustHtml( styles );
    
  }

  /* 
  * We are listening for postMessage events from the iframe pages. When something needs to happen, a message is sent from the iframe as a JSON object, such as { iablink: 'http://apppresser.com', target: '_blank', options: '' }. We parse that object here, and do the phonegap stuff like window.open(data.iablink)
  */

  attachListeners() {

    // When WP site loads, attach our click events
    window.addEventListener('message', (e) => {

      console.log('postMessage', e.data);

      if( e.data === 'checkin_success' ) {

        this.presentToast('Check in successful!');

      } else if ( e.data === 'logout' ) {

        this.userLogout()

      }

      // if it's not our json object, return
      if (e.data.indexOf('{') != 0)
        return;

      var data = JSON.parse(e.data);

      if (data.url) {

        // push a new page
        let page = { title: data.title, component: Iframe, url: data.url, classes: null };
        this.nav.push(Iframe, page);

      } else if (data.msg) {

        // social sharing was clicked, show that
        SocialSharing.share(data.msg, null, null, data.link);

      } else if (data.iablink) {

        // in app browser links
        this.openIab(data.iablink, data.target, data.options);

      } else if (data.camera && data.camera === 'library' ) {

        if(data.appbuddy === true ) {
          this.appCamera.photoLibrary(true);
        } else {
          this.appCamera.photoLibrary(false);
        }

      } else if (data.camera && data.camera === 'photo') {
        
        if (data.appbuddy === true) {
          this.appCamera.openSheet(true);
        } else {
          this.appCamera.takePicture(false);
        }

      } else if ( data.fblogin ) {

        this.fbconnect.login();

        this.maybeSendPushId( data.ajaxurl );

      } else if ( data.paypal_url ) {

        this.appwoo.paypal( data.paypal_url, data.redirect );

      } else if( data.loggedin ) {

        this.storage.set('user_login', this.login_data )

        this.userLogin(data)

        this.maybeSendPushId( data.ajaxurl );

      }

    }, false); // end eventListener

  }

  openIab( link, target, options = null ) {

    window.open(link, target, options );

  }

  maybeDoAds(data) {

    // only show ads on a device
    if( !Device.platform ) 
      return;

    // If we don't have any ads set, stop
    if( data.ads.ios === '' && data.ads.android === '' ) {
      console.log('No ads');
      return;
    }

    this.appads.setOptions();

    if( Device.platform === 'iOS' && data.ads.ios.banner != '' ) {
      this.appads.createBanner( data.ads.ios.banner );
    }
     
    if( Device.platform === 'Android' && data.ads.android.banner != '' ) {
      this.appads.createBanner( data.ads.android.banner );
    }

    // show interstitial like this
    // this.appads.interstitial( data.ads.ios.interstitial );

  }

  maybeDoPush() {

    let push = null;

    try {

      push = Push.init({
        android: {
            senderID: "[[gcm_sender]]"
        },
        ios: {
            alert: "true",
            badge: true,
            clearBadge: true,
            sound: 'false'
        },
        windows: {}
      });

    } catch(err) {
      console.log(err);
      return;
    }

    console.log(push);

    if( push.error )
      return;

    push.on('registration', (data) => {

      // kick off aws stuff
      this.pushService.subscribeDevice(data.registrationId).then( (result:string) => {
        console.log(result);
        var newresult = JSON.parse( result );

        window.localStorage.setItem('endpointArn', newresult.endpointArn );

      });

    });

    push.on('notification', (data) => {

      if( data.additionalData && (<any>data).additionalData.page ) {

        let page = (<any>data).additionalData.page;

        // if page is external, fire the in app browser
        if( page.target === '_blank' ) {
          this.openIab( page.url, page.target );
          return;
        }

        // if they included an app page, load the page
        this.pushPage( (<any>data).additionalData.page );
        return;
      }

      Dialogs.alert(
        data.message,  // message
        data.title,            // title
        'Done'                // buttonName
      );

    });

    push.on('error', (e) => {
      console.log(e.message);
    });

  }

  maybeSendPushId( ajaxurl ) {

    let id = window.localStorage.getItem('endpointArn' );

    if( id ) {
      // ajax call to save this to user meta
      this.pushService.sendDeviceToWp(id, ajaxurl).then( result => {
        console.log(result);
      });
    }

  }

  presentToast(msg) {

    let toast = this.toastCtrl.create({
      message: msg,
      duration: 5000,
      position: 'bottom'
    });

    toast.present();

  }

  menuOpened() {
    this.menu.swipeEnable(true)
  }

  menuClosed() {
    this.menu.swipeEnable(false)
  }

  openLoginModal() {

    this.loginModal = this.modalCtrl.create( LoginModal );
    
    this.loginModal.present();

  }

  userLogin(data) {

    this.login_data = data

    // tell the modal we are logged in
    this.events.publish('modal:logindata', data )

    this.presentToast('Login successful')

    if( this.pages )
      this.resetSideMenu(true)

    if( this.tabs )
      this.resetTabs(true)
  }

  userLogout() {
    // this.storage.remove('user_login').then( () => {
    //   this.presentToast('Logged out successfully.')
    // })

    this.login_data = null;

    if( this.tabs && this.pages ) {
      this.resetTabs(false)
      this.resetSideMenu(false)
    } else if( this.tabs ) {
      this.resetTabs(false)
    } else {
      this.resetSideMenu(false)
      // this.openPage(this.pages[0])
    }

    this.presentToast('Logout successful')

  }

  // show or hide menu items on login or logout. resetSideMenu(false) for logout
  resetSideMenu( login ) {
    for( let item of this.pages ) {

      if( login === true && item.extra_classes.indexOf('loggedin') >= 0 ) {
        item.extra_classes += " show";
      } else if( login === false && item.extra_classes.indexOf('loggedin') >= 0 ) {
        item.extra_classes = item.extra_classes.replace(" show", "");
      }

    }
  }

  // show or hide tabs on login or logout. resetTabs(false) for logout
  resetTabs( login ) {

    this.navparams = []

    for( let item of this.tabs ) {

      // set component, default is Iframe
      var root:Object = Iframe;

      if( item.type === 'apppages' && item.page_type === 'list' ) {
        root = PostList;
      } else if( item.type === 'apppages' ) {
        root = CustomPage;
      }

      // hide the tab if user added class of hide
      item.show = true;
      if( item.extra_classes.indexOf('hide') >= 0 ) {
        item.show = false;
      }

      if( login === false && item.extra_classes.indexOf('loggedin') >= 0 ) {
        item.show = false;
      }

      item.class = item.icon

      this.navParamsPush( item, root )

    }

    this.tabs = this.navparams;

    // "refresh" the view by resetting to home tab
    if( login === false )
        this.openPage( { 'title': this.tabs[0].title, 'url': '', 'component': TabsPage, 'navparams': this.navparams, 'class': this.tabs[0].icon } )

  }

}