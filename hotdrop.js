/*
* Drops field suggestions like it's hot.
*/

KEY_TAB   = 9;
KEY_CR    = 13;
KEY_ESC   = 27;
KEY_UP    = 38;
KEY_DOWN  = 40;

/*
* Populates these global vars on mouse movement.
* Necessary to close drop-down on field blur except
* when clicking inside the drop-down itself.
*/
jQuery().mousemove(function(e) {
  pageX = e.pageX;
  pageY = e.pageY;
});

new function(jQuery) {
  jQuery.fn.setCursorPosition = function(pos) {
    if (jQuery(this).get(0).setSelectionRange) {
      jQuery(this).get(0).setSelectionRange(pos, pos);
    } else if (jQuery(this).get(0).createTextRange) {
      var range = jQuery(this).get(0).createTextRange();
      range.collapse(true);
      range.moveEnd('character', pos);
      range.moveStart('character', pos);
      range.select();
    }
  }
}(jQuery);

var _hot_current = -1;
var _hot_size = 0;
var _hot_current_value = "";

function putDropListValueInField(data_field, new_str, len, multiples) {
  var val = data_field.val();
  if( multiples ) {
    data_field.val(val.substring(0, val.length-len) + new_str + ", ");
  } else {
    data_field.val(new_str);
  }
}

var _hot_section_count = 0;
var _hot_complete_load_empty = 0;

// TODO: Register new types
// this.url_type: 'json', 'odjs', 'xml', 'get', 'post'

function HotDataSource(params) {
  this.empty = null;
  this.max = null;
  // XXX: haw backward compatible is this?
  if( params instanceof Array ) { //typeof params == "array" ) {
    this.hot_data = params;
  } else {
    this.url = params['url'];
    this.url_params = params['url_params'];
    this.url_type = params['url_type'];
    if( !this.url_type ) this.url_type = 'json';
    this.hot_data = params['data'];
    this.header = params['header'];
    this.empty = params['empty'];
    this.section = ++_hot_section_count;
    this.limit = params['limit'];
  }
  if( !this.empty ) this.empty = 'No matches found';
  if( !this.limit ) this.limit = 10;

  this.field_selector = '#search';
  this.drop_selector = '#search_suggest';
  this.hot_drop = null;
  
  // TODO: insert empty string data if overridden
  this.match_not_found = function() {
    return "<span class=\"hotdrop-empty\">"+this.empty+"</span>";
  };
  
  this.match_finder = function( prefix ) {
    var matches = [];
    for(var i=0; i<this.hot_data.length; i++) {
      var cc = this.hot_data[i];
      if(this.hot_data[i].match(new RegExp("^"+prefix, "i"))==prefix) {
        matches.push(cc);
      }
    }
    return matches;
  };
  
  // process_input
  this.pre_process_input = function( input ) {
    return input.toLowerCase().replace(/[\[\]'",.()<> ]/gi, "");
  };
  
  // process_output
  this.post_process_output = function( item ) {
    return item;
  };
  
  // process_output
  this.pre_process_output = function( data ) {
    return data;
  }
  
  this.section_id = function() {
    return "search_suggest_section_"+this.section;
  };
  
  this.insert_header = function(header_string, section_id) {
    jQuery("<p class=\"hotdrop-title\"/>").attr('id',this.section_id()).html(header_string).appendTo(this.drop_selector);
  }
  
  this.remote_params = function(processed_input) {
    return {input: processed_input};
  }
  
  if( params['pre_process_input'] ) this.pre_process_input = params['pre_process_input'];
  if( params['pre_process_output'] ) this.pre_process_output = params['pre_process_output'];
  if( params['post_process_output'] ) this.post_process_output = params['post_process_output'];
  if( params['remote_params'] ) this.remote_params = params['remote_params'];
}

/*
* Class-bound method execute, responsible for... well... executing.
*/
HotDataSource.prototype.execute = function( input ) {
  if( this.header ) {
    this.insert_header(this.header, this.section);
  }

  var processed_input = this.pre_process_input( input );

  // get data from ajax or data
  if( this.url ) {
    var section_id = "#" + this.section_id();
    jQuery(section_id).after('<span class=\"hotdrop-loading\">Loading...</span>');
    var self = this;

    // TODO: a mechanism for registering new types
    if( this.url_type == 'json' ) {
      jQuery.getJSON(this.url, this.remote_params(processed_input), function( data, textStatus ) {
        // data = self.pre_process_output( data );
        self.populate( data );
      });
    } else if (this.url_type == 'odjs' ) {
      var script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = this.url + encodeURIComponent( processed_input );
      document.body.appendChild( script );
    } else if (this.url_type == 'get' ) {
      jQuery.get(this.url, this.remote_params(processed_input), function( data, textStatus ) {
        data = self.pre_process_output( data );
        self.populate( data );
      });
    } else if (this.url_type == 'post' ) {
      jQuery.post(this.url, this.remote_params(processed_input), function( data, textStatus ) {
        data = self.pre_process_output( data );
        self.populate( data );
      });
    }
  } else {
    var data = this.match_finder( processed_input );
    this.populate( data );
  }
};

/*
* Class-bound method populate, drives population of the
* drop-down with the given data. Assumes "data" is
* in an array form by this point. Pre-processing
* is done before this point.
*/
HotDataSource.prototype.populate = function( data ) {
  if( data.length > this.limit ) {
    _hot_size += this.limit
  } else {
    _hot_size += data.length;
  }
  jQuery(this.drop_selector).show();

  if( this.url ) {
    jQuery(this.drop_selector + " span.hotdrop-loading").remove();
  }

  var section_id = "#" + this.section_id();
  var header_exists = jQuery( section_id ).length > 0;

  if( !data || data.length <= 0 ) {
    _hot_complete_load_empty += 1;
    if( header_exists ) {
      jQuery(this.match_not_found()).insertAfter( section_id );
    } else if ( _hot_complete_load_empty == 0 ) {
      jQuery(this.drop_selector).append( this.match_not_found() );
    }
  } else {
    var self = this;
    jQuery.each(data, function( i, item ) {
      if( self.limit && i >= self.limit ) {
        return;
      }
      
      var d = jQuery("<div/>").attr("class", "hotdrop-unselect");
      d.html( self.post_process_output( item ) );

      d.mouseover(function() {
        // TODO: do we really need to iterate here? can't we set all by selector?
        jQuery(self.drop_selector + " > div").each(function(){
          this.className = "hotdrop-unselect";
        });
        this.className = "hotdrop-select";
      });

      // on click copy the result text to the search field and hide
      d.click( function() {
        var data_field = jQuery(self.field_selector);
        putDropListValueInField(data_field, this.childNodes[0].nodeValue, self.hot_drop.input.length, self.hot_drop.multiples);
        self.hot_drop.clear_drop(self.drop_selector);
        data_field.focus();
        data_field.setCursorPosition( data_field.val().length );
      });

      if( header_exists ) {
        d.insertAfter(section_id);
      } else {
        d.appendTo(self.drop_selector);
      }
    });
  }
};


/*
* Represents a single field, dropbox, and collection of datasources.
*/
function HotDrop(params) {
  this.field_id = params['field_id'];
  if( !this.field_id ) this.field_id = "search";
  this.drop_id = params['drop_id'];
  if( !this.drop_id ) this.drop_id = "search_suggest";
  this.field_selector = params['field_selector'];
  if( !this.field_selector ) this.field_selector = "#" + this.field_id;
  this.drop_selector = params['drop_selector'];
  if( !this.drop_selector ) this.drop_selector = "#" + this.drop_id;
  this.datasources = params['datasources'];
  if( !this.datasources ) this.datasources = [];
  this.multiples = params["multiples"];
  this.input = "";
  
  this.add_data_source = function( datasource ) {
    if( datasource instanceof Array ) {
      this.datasources.push( new HotDataSource( datasource ) );
    } else {
      this.datasources.push( datasource );
    }
  };
  
  this.pre_process_input = function( input ) {
    return input.replace(/[\[\]'",.()<> ]/gi, "");
  };
  
  this.clear_drop = function( selector, hide ) {
    jQuery( selector ).hide();
    jQuery( selector ).empty();
    _hot_current_value = "";
    _hot_size = 0;
    _hot_current = -1;
  };
  
  this.navigate_drop_list = function( key_code ) {
    if( key_code != KEY_DOWN && key_code != KEY_UP ) {
      _hot_current = -1;
      return false;
    }

    if( key_code == KEY_UP ) {
      _hot_current = ( _hot_current == 0 || _hot_current == -1 ) ? _hot_size - 1 : _hot_current - 1;
    } else {
      _hot_current = ( _hot_current == _hot_size - 1) ? 0 : _hot_current + 1;
    }

    // loop through each result div applying the correct style
    jQuery(this.drop_selector + " > div").each(function(i) {
      if( i == _hot_current ) {
        _hot_current_value = this.childNodes[0].nodeValue;
        this.className = "hotdrop-select";
      } else {
        this.className = "hotdrop-unselect";
      }
    });

    return true;
  };
  
};

HotDrop.prototype.attach = function() {
  for(var i=0;i<this.datasources.length;i++) {
    this.datasources[i].drop_selector = this.drop_selector;
    this.datasources[i].field_selector = this.field_selector;
    this.datasources[i].hot_drop = this;
  }
  
  var self = this;
  
  jQuery(this.drop_selector).hide();
  
  // when anything other than field or drop-down is clicked
  jQuery(this.field_selector).blur(function(e) {
    var results = jQuery( self.drop_selector );
    var resPos = results.offset();

    resPos.bottom = resPos.top + results.height();
    resPos.right = resPos.left + results.width();

    if (pageY > resPos.bottom || pageY < resPos.top || pageX < resPos.left || pageX > resPos.right) {
      self.clear_drop( self.drop_selector );
    }
  });
  
  // on key down
  jQuery(this.field_selector).keydown(function(e) {
    var key_code = e.keyCode || window.event.keyCode;

    // check for an ESC
    if( key_code == KEY_ESC ) {
      self.clear_drop( self.drop_selector );
      return false;
    }

    if( self.navigate_drop_list(key_code) ) { return false; }

    // check for an ENTER or TAB
    if( key_code == KEY_CR || key_code == KEY_TAB ) {
      if( _hot_current_value == "" ) return true;
      var v = jQuery( self.field_selector ).val();
      var input = v;
      // prefix after seperator
      if( !input ) input = '';
      var loc = input.lastIndexOf(',');
      if( loc > 0 ) {
        var max = input.length;
        for( loc=loc+1; loc<max; loc++) {
          // grab the location of the first nonwhitespace
          if( input.charAt(loc) != ' ' ) break;
        }
        input = input.substring(loc);
      }

      var data_field = jQuery(self.field_selector);

      // var val = data_field.val();
      // data_field.val(val.substring(0, val.length-len) + new_str + ", ");

      putDropListValueInField(data_field, _hot_current_value, input.length, self.multiples);

      // putDropListValueInField(data_field, v, input.length, this.hot_drop.multiples);
      // self.hot_drop.clear_drop(self.drop_selector);
      // data_field.focus();
      // data_field.setCursorPosition( data_field.val().length );
      // 
      // data_field.val(v.substring(0, v.length-input.length) + _hot_current_value + ", ");
      self.clear_drop( self.drop_selector );
      return false;
    }

    return true;
  });
  
  // on key up
  jQuery(this.field_selector).keyup(function(e) {
    // get keyCode (window.event is for IE)
    var key_code = e.keyCode || window.event.keyCode;

    // none of these keys are useful to us at this point
    if( key_code == KEY_CR
     || key_code == KEY_TAB
     || key_code == KEY_ESC
     || key_code == KEY_UP
     || key_code == KEY_DOWN)
    {
      return; 
    }

    var input = jQuery(self.field_selector).val();
    // input after seperator
    if( !input ) input = '';
    var loc = input.lastIndexOf(',');
    if( loc > 0 ) {
      var max = input.length;
      for( loc=loc+1; loc<max; loc++) {
        // grab the location of the first nonwhitespace
        if( input.charAt(loc) != ' ' ) break;
      }
      input = input.substring(loc);
    }
    self.input = input;
    var processed_input = self.pre_process_input( input );

    if ( processed_input.length > 0 ) {
      _hot_size = 0
      self.clear_drop( self.drop_selector );

      // set to datasource total
      _hot_complete_load_empty = -self.datasources.length;

      for(var i=0;i<self.datasources.length;i++) {
        self.datasources[i].execute( input );
      }
    }
    else {
      self.clear_drop( self.drop_selector );
    }
  });
};


/*
* Helper function to simplify creation of basic HotDrops
*/
function makeHotDrop(datasource_or_array, field_id, drop_id) {
  if( !(datasource_or_array instanceof HotDataSource) ) {
    var ary = datasource_or_array;
    datasource_or_array = new HotDataSource({ data:ary });
  }
  var drop = new HotDrop({
    field_id:field_id,
    drop_id:drop_id,
    datasources:[datasource_or_array]
  });
  drop.attach();
  return drop;
}
