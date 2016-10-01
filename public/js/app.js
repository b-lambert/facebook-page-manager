var Post = React.createClass({
  getInitialState: function(){
    return {is_published: this.props.is_published};
  },
  
  render: function() {
    var button_class = this.state.is_published ? "hide" : "card-action"
    var date_components = this.props.created_time.split(/[- :T+]/);
    // Can't use .toLocaleString() in mobile Safari
    var date = date_components[1] + "/" + date_components[2] + "/" + date_components[0] + " " + date_components[3] + ":" + date_components[4];
    return (
      <div className="card">
        <div className="card-image">
          <img src={this.props.full_picture}/>
        </div>
        <div className="card-content">
          <p>
            <em>{date}</em>
          </p>
          <p>
            <b>{this.props.message}</b>
          </p>
          <p><a target="_blank" href={this.props.link}>{this.props.link}</a></p>
          <p>
            <em>View Count: {this.props.view_count}</em>
          </p>
          <p>
            <em>{this.state.is_published ? "Published" : "Unpublished"}</em>
          </p>
        </div>
        <div className={button_class}>
          <a onClick={this.publishPost} className="btn indigo darken-4">Publish</a>
        </div>
      </div>
    );
  },
  
  publishPost: function(){
    var that = this;
    $.ajax({
      url: "https://graph.facebook.com/v2.7/" + that.props.id,
      dataType: 'json',
      type: "POST",
      data: {access_token: that.props.access_token, is_published: true},
      success: function(data){
        that.setState({is_published: true, is_loading: false});
      },
      error: function(err) {
        that.state({is_loading: false});
      }
    });
  }
});

var PaginateButton = React.createClass({
  render: function(){
    if (this.props.next_page !== undefined && this.props.next_page.length > 0 && this.props.data.length >= 10) {
      return(
        <a onClick={this.props.loadNextPage} className="btn indigo darken-4" >See Older Posts</a>
      );
    }
    else {
      return(
        <div></div>
      );
    }
  },
});

var PostBox = React.createClass({
  loadPostsFromServer: function() {
    var that = this;
    $.ajax({
      url: this.props.url,
      dataType: 'json',
      cache: false,
      data: {access_token: this.state.access_token, limit: 10, fields: "is_published,message,full_picture,created_time,link"},
      success: function(data) {
        if(data.paging !== undefined && data.paging.next !== undefined) {
          this.setState({next_page: data.paging.next});
        }

        // Get insight data, if it exists.
        var that = this;
        $.each(data.data, function(index, data){
          $.ajax({
            url: 'https://graph.facebook.com/v2.7/' + data.id + '/insights/page_impressions_unique',
            dataType: 'json',
            data: {access_token: that.state.access_token},
            success: function(insight_data){
              if(insight_data.data.length === 0){
                data.view_count = 0; // This means we don't have 30 likes for insight data.
              }
              that.forceUpdate();
            }
          });
        });
        
        that.setState({data: data.data, is_loading: false});

      }.bind(this),
      error: function(err) {
        that.setState({is_loading: false, error: err.responseJSON.error.message});
      }.bind(this)
    });
  },

  handlePostSubmit: function(post) {
    this.setState({is_loading: true, error: ""});
    var that = this;
    $.ajax({
      url: this.props.submit_url,
      dataType: 'json',
      type: 'POST',
      data: {link: post.link, published: post.is_published, message: post.text, access_token: this.state.access_token, scheduled_post_date: this.state.scheduled_post_date},
      success: function(data) {
        $.ajax({
          url: "https://graph.facebook.com/v2.7/" + data["id"],
          dataType: 'json',
          data: {access_token: this.state.access_token, fields: "full_picture"},
          success: function(data){
            var posts = that.state.data;
            post.full_picture = data.full_picture
            post.id = data.id;
            post.message = post.text;
            post.created_time = new Date().toISOString();
            post.view_count = 0; // I'm okay with hard-coding this since this is a brand new post.
            var newPosts = [post].concat(posts);
            that.setState({data: newPosts, is_loading: false});
          }
        });
        
      }.bind(this),
      error: function(err) {
        that.setState({is_loading: false, error: err.responseJSON.error.message});
      }.bind(this)
    });
  },
  
  loadNextPage: function(){
    var that = this;
    var url = this.state.next_page;
    this.setState({is_loading: true, error: ""});
    $.ajax({
      url: url,
      dataType: 'json',
      cache: false,
      data: {access_token: that.state.access_token, limit: 10},
      success: function(data) {
        if(data.paging === undefined) {
          this.setState({next_page: "", is_loading: false});
        }
        else if(data.paging.next !== undefined) {
          this.setState({next_page: data.paging.next});
        }

        var that = this;
        // Get page impressions, if we have access to insight data.
        $.each(data.data, function(index, data){
          $.ajax({
            url: 'https://graph.facebook.com/v2.7/' + data.id + '/insights/page_impressions_unique',
            data: {access_token: that.state.access_token},
            dataType: 'json',
            success: function(insight_data){
              if(insight_data.data.length === 0){
                data.view_count = 0;
              }
              that.forceUpdate();
            }
          });
        });

        var newData = that.state.data.concat(data.data);
        that.setState({data: newData, is_loading: false});
        
      }.bind(this),
      error: function(err) {
        that.setState({is_loading: false, error: err.responseJSON.error.message});
      }.bind(this)
    });
  },
  
  getInitialState: function() {
    return {error: "", is_loading: true, data: [], access_token: ""};
  },
  componentDidMount: function() {
    this.loadPostsFromServer();
  },
  login: function() {
    (function(d, s, id){
     var js, fjs = d.getElementsByTagName(s)[0];
     if (d.getElementById(id)) {return;}
     js = d.createElement(s); js.id = id;
     js.src = "//connect.facebook.net/en_US/sdk.js";
     fjs.parentNode.insertBefore(js, fjs);
    }(document, 'script', 'facebook-jssdk'));
    var that = this;
    window.fbAsyncInit = function() {
        FB.init({
          appId      : '185665701861573',
          xfbml      : true,
          version    : 'v2.7'
        });
        FB.AppEvents.logPageView();
        FB.login(function(){}, {scope: 'publish_actions,manage_pages'});
        FB.getLoginStatus(function(data){
          console.log(data);
          var access_token = data.authResponse.accessToken;
          FB.api(
            '/me/accounts',
            'GET',
            {access_token: access_token},
            function(response) {
              that.setState({access_token: response.data[0].access_token, error: ""});
              that.loadPostsFromServer();
            }
          );
        });
      };
  },
  
  render: function() {
    var error_class = this.state.error.length > 0 ? "card red lighten-3" : "hide";
    var login_class = this.state.access_token.length === 0 ? "btn indigo darken-4" : "hide";
    return (
      <div className="postBox">
        <div className="container">
          <h3>Page Posts</h3>
          <div className="row">
            <div className="col s12 m8 l6">
              <PostList 
                access_token={this.state.access_token} 
                data={this.state.data} 
                is_loading={this.state.is_loading}
              />
              <div className={error_class}>
                <div className="card-content">
                  <p>{this.state.error}</p>
                </div>
              </div>
              <Loader is_loading={this.state.is_loading}/>
              <PaginateButton 
                loadNextPage={this.loadNextPage} 
                data={this.state.data} 
                access_token={this.state.access_token} 
                next_page={this.state.next_page}
              />
              <PostForm onPostSubmit={this.handlePostSubmit} />
              <a className={login_class} onClick={this.login}>Login with Facebook</a>
            </div>
          </div>
        </div>
      </div>
    );
  }
});

var PostList = React.createClass({
  render: function() {
    var that = this;
    var postNodes = $.map(this.props.data, function(post) {
      return (
        <Post 
          access_token={that.props.access_token} 
          full_picture={post.full_picture} 
          link={post.link} 
          id={post.id} 
          key={post.id} 
          message={post.message} 
          created_time={post.created_time} 
          view_count={post.view_count} 
          is_published={post.is_published}
        >
        </Post>
      );
    });

    return (
      <div className="postList">
        {postNodes}
      </div>
    );
  }
});

var Loader = React.createClass({
  render: function(){
    if (this.props.is_loading) {
      return(
        <div className="progress">
          <div className="indeterminate"></div>
        </div>
      );
    }
    else {
      return(<div></div>);
    }
  }
});

var PostForm = React.createClass({
  getInitialState: function() {
    return {text: '', is_published: false};
  },
  handleTextChange: function(e) {
    this.setState({text: e.target.value});
  },
  handleLinkChange: function(e) {
    this.setState({link: e.target.value});
  },
  handleCheckboxChange: function(){
    this.setState({is_published: !this.state.is_published});
  },
  handleSubmit: function(e) {
    e.preventDefault();
    this.setState({error: ''});
    var is_published = this.state.is_published;
    var text = this.state.text.trim();
    if (!text) {
      return;
    }
      this.props.onPostSubmit({link: this.state.link, text: text, is_published: this.state.is_published});
      this.setState({text: ''});
      this.setState({link: ''});
    },
    render: function() {
      var submitEnabled = this.state.text.length > 0 ? '' : ' disabled';
      return (
        <div className="card">
          <form className="postForm" onSubmit={this.handleSubmit}>
            <div className="card-content">
              <input
                type="text"
                placeholder="Type your page post here"
                value={this.state.text}
                onChange={this.handleTextChange}
              />
              <input
                type="text"
                placeholder="Share a link here"
                value={this.state.link}
                onChange={this.handleLinkChange}
              />
              <p>
                <input type="checkbox" id="test5" value={this.state.is_published} onChange={this.handleCheckboxChange} />
                <label htmlFor="test5">Publish Post</label>
              </p>
            </div>
            <div className="card-action">
              <input className={"btn indigo darken-4" + submitEnabled} type="submit" value="Create Post" />
            </div>
          </form>
        </div>
      );
    }
  });
  
ReactDOM.render(
  <PostBox submit_url="https://graph.facebook.com/v2.7/1844138332485211/feed" url="https://graph.facebook.com/v2.7/1844138332485211/promotable_posts" />,
  document.getElementById('content')
);
  