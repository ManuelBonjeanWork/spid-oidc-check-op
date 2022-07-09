import React, { Component } from 'react';
import view from "./view.js";
import Utility from '../../utility';
import Services from '../../services';
import ReduxStore from "../../redux/store";
import Actions from "../../redux/main/actions";
import UtilActions from "../../redux/util/actions";

class MetadataDownload extends Component {

  constructor(props) {
    super(props);
    
    this.state = {
        url: "https://",
        configuration: ""
    };  
  }	

  componentDidMount() { 
    let service = Services.getMainService();
    let store = ReduxStore.getMain();
    let storeState = store.getState();

    service.getInfo(
      (info) => {

        if(info.metadata && info.metadata.url && info.metadata.configuration) {
          this.setState({ url: info.metadata.url, configuration: info.metadata.configuration });
          store.dispatch(Actions.setMetadataURL(info.metadata.url)); 
          store.dispatch(Actions.setMetadataConfiguration(info.metadata.configuration)); 
        }

        if(info.metadata && info.metadata.url && !info.metadata.configuration) {
          this.setState({ url: info.metadata.url });          
          this.downloadMetadata(info.metadata.url);
        }
      },

      (info)=> { // no session

        if(info.metadata && info.metadata.url && info.metadata.configuration) {
          this.setState({ url: info.metadata.url, configuration: info.metadata.configuration });
          store.dispatch(Actions.setMetadataURL(info.metadata.url)); 
          store.dispatch(Actions.setMetadataConfiguration(info.metadata.configuration)); 
        }

        if(info.metadata && info.metadata.url && !info.metadata.configuration) {
          this.setState({ url: info.metadata.url });
          this.downloadMetadata(info.metadata.url);
        }
      },

      (error)=> {
        Utility.showModal({
            title: "Errore",
            body: error,
            isOpen: true
        });
      }
    );
  }
  
    render() {    
		return view(this);
  }
  

  downloadMetadata(url) {
    let service = Services.getMainService();
    let store = ReduxStore.getMain();
    let util = ReduxStore.getUtil();

    service.downloadMetadata(url,
      (metadata) => { 
        this.setState({ url: metadata.url, configuration: metadata.configuration });
        store.dispatch(Actions.setMetadataURL(url)); 
        store.dispatch(Actions.setMetadataConfiguration(metadata.configuration)); 
        util.dispatch(UtilActions.updateSidebar(true));
      }, 
      (error)   => { 
        store.dispatch(Actions.setMetadataURL(""));
        store.dispatch(Actions.setMetadataConfiguration(""));
        Utility.showModal({
            title: "Errore",
            body: error,
            isOpen: true
        });
      }
    );
  }

}

export default MetadataDownload;
