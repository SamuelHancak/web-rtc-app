import React, { Component } from "react";
import Video from "./video";

class Videos extends Component {
  constructor(props) {
    super(props);

    this.state = {
      rVideos: [],
      remoteStreams: [],
    };
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.remoteStreams !== nextProps.remoteStreams) {
      let _rVideos = nextProps.remoteStreams.map((rVideo, index) => {
        return (
          <div
            id={rVideo.name}
            //onClick={() => this.props.switchVideo(rVideo)}
            style={{ display: "inline" }}
            key={index}
          >
            <Video
              videoStream={rVideo.stream}
              frameStyle={{
                height: 120,
                width: 213,
                float: "left",
                padding: "0 3px",
              }}
              videoStyles={{
                cursor: "disabled",
                objectFit: "cover",
                borderRadius: 3,
                height: 120,
                width: 213,
                //width: "100%",
              }}
            />
          </div>
        );
      });

      this.setState({
        remoteStreams: nextProps.remoteStreams,
        rVideos: _rVideos,
      });
    }
  }

  render() {
    return (
      <div
        style={{
          zIndex: 3,
          position: "fixed",
          padding: "6px 3px",
          backgroundColor: "rgba(0,0,0,0.3)",
          height: 120,
          //width: 213,
          top: "auto",
          //right: 10,
          // left: 10,
          //bottom: 10,
          //overflowX: "block",
          whiteSpace: "nowrap",
        }}
      >
        {this.state.rVideos}
      </div>
    );
  }
}

export default Videos;
