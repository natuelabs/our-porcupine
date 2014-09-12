var porcupine = require( 'porcupine' );
var porcupineConfig = require( './configs/porcupine' );

porcupine.init( porcupineConfig, 3000 );

var eventEmitter = porcupine.getEventEmitter();
var events = porcupine.getEvents();
var config = require( './configs/natuelabs' );

/**
 * Natuelabs integration logic
 *
 * @constructor
 */
function Natuelabs () {
  'use strict';

  this.avatarUrl = {
    trello : 'https://trello-avatars.s3.amazonaws.com/[hash]/30.png'
  };

  this.jenkinsData = config.jenkinsData;
  this.ignoreUser = config.ignoreUser;
  this.projects = config.projects;

  /**
   * Events listeners
   */
  // new card created in trello
  eventEmitter.on(
    events.trello.card.created,
    this.handleTrelloCardCreated.bind( this )
  );

  // card updated in trello
  eventEmitter.on(
    events.trello.card.updated,
    this.handleTrelloCardUpdated.bind( this )
  );

  // comment card created in trello
  eventEmitter.on(
    events.trello.cardComment.created,
    this.handleTrelloCardCommentCreated.bind( this )
  );

  // attachment created in trello
  eventEmitter.on(
    events.trello.cardAttachment.created,
    this.handleTrelloCardAttachmentCreated.bind( this )
  );

  // push on github
  eventEmitter.on(
    events.github.push.created,
    this.handleGithubPushCreated.bind( this )
  );

  // release on github
  eventEmitter.on(
    events.github.release.created,
    this.handleGithubReleaseCreated.bind( this )
  );
}

/**
 * Check if it should ignore the user
 *
 * @param username
 *
 * @return bool
 */
Natuelabs.prototype.checkIgnoreUser = function ( username ) {
  if ( username === this.ignoreUser.github || username === this.ignoreUser.trello ) {
    return true;
  }

  return false;
};

/**
 * Check if trello card name has an issue number
 *
 * @param cardName
 *
 * @return bool
 */
Natuelabs.prototype.getIssueNumberFromTrelloCardName = function ( cardName ) {
  var match = cardName.match( /^#([0-9]+)/ );

  if ( match && match.length === 2 ) {
    return match[ 1 ];
  }

  match = cardName.match( /^#([A-Z]+)\-([0-9]+)/ );

  if ( match && match.length === 3 ) {
    return match[ 2 ];
  }

  return false;
};

/**
 * Remove issue from trello card name
 *
 * @param cardName
 *
 * @return bool
 */
Natuelabs.prototype.removeIssueNumberFromTrelloCardName = function ( cardName ) {
  var match = cardName.match( /^#([0-9]+)/ );

  if ( match && match.length === 2 ) {
    cardName = cardName.substring( match[ 0 ].length ).trim();
  }

  match = cardName.match( /^#([A-Z]+)\-([0-9]+)/ );

  if ( match && match.length === 3 ) {
    cardName = cardName.substring( match[ 0 ].length ).trim();
  }

  return cardName;
};

/**
 * Remove project hash from trello card name
 *
 * @param cardName
 *
 * @return bool
 */
Natuelabs.prototype.removeProjectHashFromTrelloCardName = function ( cardName ) {
  var match = cardName.match( /^#([A-Z]+)/ );

  if ( match && match.length === 2 ) {
    cardName = cardName.substring( match[ 0 ].length ).trim();
  }

  return cardName;
};

/**
 * Get project data from trello card name
 *
 * @param cardName
 *
 * @return object
 */
Natuelabs.prototype.getProjectFromTrelloCardName = function ( cardName ) {
  var match = cardName.match( /^#([A-Z]+)/ );
  var returnProject = this.projects.shop;

  var project;

  if ( match && match.length === 2 ) {
    var keys = Object.getOwnPropertyNames( this.projects );
    keys.forEach( function ( key ) {
      project = this.projects[key];

      if ( project.trello.code === match[1] ) {
        returnProject = project;
      }
    }.bind( this ) );
  }

  return returnProject;
};

/**
 * Get project data from github repo
 *
 * @param repoName
 * @param repoOwner
 *
 * @return object
 */
Natuelabs.prototype.getProjectFromGithubRepo = function ( repoName, repoOwner ) {
  var returnProject = this.projects.shop;

  var project;

  var keys = Object.getOwnPropertyNames( this.projects );
  keys.forEach( function ( key ) {
    project = this.projects[key];

    if ( project.github.repo === repoName && project.github.owner === repoOwner ) {
      returnProject = project;
    }
  }.bind( this ) );

  return returnProject;
};

/**
 * Handle the emitted trello created event
 *
 * @param data
 */
Natuelabs.prototype.handleTrelloCardCreated = function ( data ) {
  if ( this.checkIgnoreUser( data.user.username ) ) {
    this.log( false, 'Created by porcupine: ' + data.title );

    return;
  }

  if ( this.getIssueNumberFromTrelloCardName( data.title ) ) {
    this.log( false, 'Card already has an issue: ' + data.title );

    return;
  }

  var project = this.getProjectFromTrelloCardName( data.title );
  var cardName = this.removeProjectHashFromTrelloCardName( data.title );

  eventEmitter.emit(
    events.github.issue.create,
    {
      owner : project.github.owner,
      repo : project.github.repo,
      title : cardName
    },
    function callback ( err, response ) {
      this.handleGithubIssueCreate( err, response, data, project );
    }.bind( this )
  );
};

/**
 * Handle the emitted trello updated event
 *
 * @param  {Object} data
 */
Natuelabs.prototype.handleTrelloCardUpdated = function ( data ) {
  if ( this.checkIgnoreUser( data.user.username ) ) {
    this.log( false, 'Created by porcupine: ' + data.title );

    return;
  }

  var id = this.getIssueNumberFromTrelloCardName( data.title );

  if ( ! id ) {
    this.log( false, 'Card title doesn\'t include an issue: ' + data.title );

    return;
  }

  var project = this.getProjectFromTrelloCardName( data.title );
  var cardName = this.removeIssueNumberFromTrelloCardName( data.title );

  eventEmitter.emit(
    events.github.issue.update,
    {
      owner : project.github.owner,
      repo : project.github.repo,
      id : id,
      state : data.closed ? 'closed' : 'open',
      title : cardName,
      body : data.body
    },
    function callback ( err, response ) {
      if ( err ) {
        this.log( err, response );

      }
    }.bind( this )
  );
};

/**
 * Handle the emitted trello card comment created event
 *
 * @param  {Object} data
 */
Natuelabs.prototype.handleTrelloCardCommentCreated = function ( data ) {
  if ( this.checkIgnoreUser( data.user.username ) ) {
    this.log( false, 'Created by porcupine: ' + data.card.title );

    return;
  }

  var id = this.getIssueNumberFromTrelloCardName( data.card.title );

  if ( ! id ) {
    this.log( false, 'Card title doesn\'t include an issue: ' + data.card.title );

    return;
  }

  var project = this.getProjectFromTrelloCardName( data.card.title );
  var prefixComment = data.user.name;

  if ( data.user.avatarHash ) {
    prefixComment = '![' + data.user.name + '](' + this.avatarUrl.trello.replace( '[hash]', data.user.avatarHash ) + ' "' + data.user.name + '")';
  }

  eventEmitter.emit(
    events.github.issueComment.create,
    {
      owner : project.github.owner,
      repo : project.github.repo,
      card : {
        id : id
      },
      body : prefixComment + ' -> ' + data.text
    },
    function callback ( err, response ) {
      if ( err ) {
        this.log( err, response );
      }
    }.bind( this )
  );
};

/**
 * Handle the emitted trello card attachment created event
 *
 * @param  {Object} data
 */
Natuelabs.prototype.handleTrelloCardAttachmentCreated = function ( data ) {
  if ( this.checkIgnoreUser( data.user.username ) ) {
    this.log( false, 'Created by porcupine: ' + data.card.title );

    return;
  }

  var id = this.getIssueNumberFromTrelloCardName( data.card.title );

  if ( ! id ) {
    this.log( false, 'Card title doesn\'t include an issue: ' + data.card.title );

    return;
  }

  var project = this.getProjectFromTrelloCardName( data.card.title );
  var prefixComment = data.user.name;

  if ( data.user.avatarHash ) {
    prefixComment = '![' + data.user.name + '](' + this.avatarUrl.trello.replace( '[hash]', data.user.avatarHash ) + ' "' + data.user.name + '")';
  }

  eventEmitter.emit(
    events.github.issueComment.create,
    {
      owner : project.github.owner,
      repo : project.github.repo,
      card : {
        id : id
      },
      body : prefixComment + ' -> [' + data.name + '](' + data.url + ')'
    },
    function callback ( err, response ) {
      if ( err ) {
        this.log( err, response );

      }
    }.bind( this )
  );
};

/**
 * Handle the emitted github push created event
 *
 * @param  {Object} data
 */
Natuelabs.prototype.handleGithubPushCreated = function ( data ) {
  if ( data.repository.name !== this.projects.shop.github.repo || data.repository.owner !== this.projects.shop.github.owner ) {
    this.log( false, 'Push ignored, repo ' + data.repository.name + ', owner ' + data.repository.owner );

    return;
  }

  eventEmitter.emit(
    events.jenkins.job.build,
    {
      job : this.jenkinsData.refreshBranches
    },
    function callback ( err, response ) {
      if ( err ) {
        this.log( err, response );

      }
    }.bind( this )
  );
};

/**
 * Handle the emitted github release created event
 *
 * @param  {Object} data
 */
Natuelabs.prototype.handleGithubReleaseCreated = function ( data ) {
  if ( data.repository.name !== this.projects.shop.github.repo || data.repository.owner !== this.projects.shop.github.owner ) {
    this.log( false, 'Release ignored, repo ' + data.repository.name + ', owner ' + data.repository.owner );

    return;
  }

  eventEmitter.emit(
    events.jenkins.job.build,
    {
      job : this.jenkinsData.deployStaging,
      params : {
        TAG_STRING : data.tag
      }
    },
    function callback ( err, response ) {
      if ( err ) {
        this.log( err, response );

      }
    }.bind( this )
  );
};

/**
 * Handle the emitted github issue create event
 *
 * @param  {Object} err
 * @param  {Object} response
 * @param  {Object} data
 * @param  {Object} project
 */
Natuelabs.prototype.handleGithubIssueCreate = function ( err, response, data, project ) {
  if ( err ) {
    this.log( err, response );

    return;
  }

  eventEmitter.emit(
    events.github.issueComment.create,
    {
      owner : project.github.owner,
      repo : project.github.repo,
      card : {
        id : response.id
      },
      body : 'Trello: https://trello.com/c/' + data.id
    },
    function callback ( err, response ) {
      if ( err ) {
        this.log( err, response );

      }
    }.bind( this )
  );

  var cleanCardName = this.removeProjectHashFromTrelloCardName( data.title );
  var cardName = '#' + project.trello.code + '-' + response.id + ' ' + cleanCardName;

  eventEmitter.emit(
    events.trello.card.update,
    {
      id : data.id,
      title : cardName
    },
    function callback ( err, response ) {
      if ( err ) {
        this.log( err, response );

      }
    }.bind( this )
  );

  eventEmitter.emit(
    events.trello.cardComment.create,
    {
      id : data.id,
      text : 'GitHub: ' + response.url
    },
    function callback ( err, response ) {
      if ( err ) {
        this.log( err, response );

      }
    }.bind( this )
  );
};

/**
 * Log
 *
 * @param err
 * @param data
 */
Natuelabs.prototype.log = function ( err, data ) {
  if ( err ) {
    console.log( '[-->] Error: ' + err );
  }

  if ( data ) {
    console.log( '[-->] ' + data );
  }
};

new Natuelabs();