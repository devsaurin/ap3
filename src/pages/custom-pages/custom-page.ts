import {Component, Renderer, ElementRef} from '@angular/core';
import {Iframe} from '../../pages/iframe/iframe';
import {PostList} from '../../pages/post-list/post-list';
import {Nav, NavParams, ModalController} from 'ionic-angular';

import {IonicModule} from 'ionic-angular';

import {IComponentInputData} from 'angular2-dynamic-component/index';

import {MediaPlayer} from '../media-player/media-player';

class DynamicContext {
  value: string;
  pages: any;
  tab_menu_items: any;

  constructor(){
  }

  onChange() {
    //console.log(this.value)
  }

}

/*
 * Uses dynamic component creation, see https://github.com/apoterenko/angular2-dynamic-component
 */
@Component({
  templateUrl: "custom-page.html"
})
export class CustomPage {

	pagetitle: string;
	listenFunc: Function;

	constructor( 
		public navParams: NavParams, 
		public nav: Nav,
		public modalCtrl: ModalController,
		public renderer: Renderer,
    	public elementRef: ElementRef ) {
		this.pagetitle = navParams.data.title;
	}

	templateUrl: string;
	extraModules = [IonicModule];
	inputData: IComponentInputData = {
		// anything that the template needs access to goes here
		pages: JSON.parse( window.localStorage.getItem( 'myappp' ) ),
		pushPage: (page) => {

			if( page.target === '_blank' ) {
		      window.open( page.url, page.target, null );
		      return;
		    }

			if( page.type === 'apppages' && page.page_type === 'list' ) {
				this.nav.push( PostList, page );
			} else if( page.type === 'apppages' ) {
				this.nav.push( CustomPage, page );
			} else if (page.url) {
				this.nav.push(Iframe, page);
			} else {
				this.nav.push(page.component, page.navparams);
			}
		},
		openPage: ( page ) => {

			if( page.target === '_blank' ) {
			  window.open( page.url, page.target, null );
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

		},
		mediaModal: ( src, img = null ) => {

			let modal = this.modalCtrl.create(MediaPlayer, {source: src, image: img});
			modal.present();

		}
	};

	ngOnInit() {
		console.log(this.navParams);
		// set our custom template url
		let slug = this.navParams.data.slug;
		this.templateUrl = 'build/' + slug + '.html';

		this.listener()
	}

	listener() {
		// Listen for link clicks, open in in app browser
	    this.listenFunc = this.renderer.listen(this.elementRef.nativeElement, 'click', (event) => {
	      if( event.target.href && event.target.href.indexOf('http') >= 0 ) {
	        event.preventDefault();
	        window.open( event.target.href, '_blank' );
	      }
	    });
	}

}