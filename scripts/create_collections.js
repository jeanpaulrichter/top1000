/* global db */
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      properties: {
        gender: {
          bsonType: 'string',
          description: 'user gender'
        },
        groups: {
          additionalProperties: false,
          properties: {
            critic: {
              bsonType: 'bool'
            },
            wasted: {
              bsonType: 'bool'
            },
            gamer: {
              bsonType: 'bool'
            },
            journalist: {
              bsonType: 'bool'
            },
            scientist: {
              bsonType: 'bool'
            }
          },
          bsonType: 'object',
          description: 'groups of user',
          required: [
            'gamer',
            'journalist',
            'scientist',
            'critic',
            'wasted'
          ]
        },
        token: {
          bsonType: 'string',
          description: 'user verification token'
        },
        key: {
          bsonType: 'string',
          description: 'hex string of user key'
        },
        salt: {
          bsonType: 'string',
          description: 'hex string of salt'
        },
        age: {
          minimum: 0,
          maximum: 10,
          bsonType: 'int',
          description: 'user age'
        },
        _id: {
          bsonType: 'objectId',
          description: '_id is the unique objectId key'
        },
        email: {
          bsonType: 'string',
          description: 'user email address'
        },
        creation_date: {
          bsonType: 'date',
          description: 'date of user creation'
        }
      },
      bsonType: 'object',
      required: [
        '_id',
        'email',
        'key',
        'salt',
        'gender',
        'age',
        'groups',
        'creation_date'
      ],
      additionalProperties: false
    }
  }
});
db.createCollection("votes", {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        '_id',
        'user_id',
        'game_id',
        'game_title',
        'game_year',
        'game_moby_id',
        'age',
        'gender',
        'groups',
        'position'
      ],
      additionalProperties: false,
      properties: {
        _id: {
          bsonType: 'objectId',
          description: '_id is the unique objectId key'
        },
        user_id: {
          bsonType: 'objectId',
          description: 'objectId key of user'
        },
        game_id: {
          bsonType: 'objectId',
          description: 'objectId key of game'
        },
        game_title: {
          bsonType: 'string',
          description: 'game title string'
        },
        game_year: {
          bsonType: 'int',
          description: 'game release year'
        },
        game_moby_id: {
          bsonType: 'int',
          description: 'game mobygames id'
        },
        age: {
          bsonType: 'int',
          description: 'user age',
          minimum: 0,
          maximum: 10
        },
        gender: {
          bsonType: 'string',
          description: 'user gender'
        },
        groups: {
          bsonType: 'object',
          description: 'groups of user',
          required: [
            'gamer',
            'journalist',
            'scientist',
            'critic',
            'wasted'
          ],
          additionalProperties: false,
          properties: {
            gamer: {
              bsonType: 'bool'
            },
            journalist: {
              bsonType: 'bool'
            },
            scientist: {
              bsonType: 'bool'
            },
            critic: {
              bsonType: 'bool'
            },
            wasted: {
              bsonType: 'bool'
            }
          }
        },
        position: {
          bsonType: 'int',
          description: 'position of game on user list',
          minimum: 0,
          maximum: 100
        },
        comment: {
          bsonType: 'string',
          description: 'user comment about game'
        }
      }
    }
  }
});
db.createCollection("games", {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        '_id',
        'title',
        'moby_id',
        'moby_url',
        'genres',
        'platforms',
        'screenshots',
        'description',
        'year'
      ],
      additionalProperties: false,
      properties: {
        icon: {
          bsonType: 'string',
          description: 'game icon data'
        },
        genres: {
          bsonType: [
            'array'
          ],
          description: 'game genres',
          items: {
            bsonType: 'string',
            description: 'genre name'
          }
        },
        moby_url: {
          description: 'mobygames.com game url',
          bsonType: 'string'
        },
        cover_url: {
          bsonType: 'string',
          description: 'url of cover image'
        },
        thumbnail_url: {
          bsonType: 'string',
          description: 'url of cover thumbnail'
        },
        moby_id: {
          bsonType: 'int',
          description: 'mobygames.com game id'
        },
        year: {
          bsonType: 'int',
          description: 'release year of game'
        },
        screenshots: {
          bsonType: [
            'array'
          ],
          description: 'game sample screenshots',
          items: {
            bsonType: 'string',
            description: 'url of screenshot'
          }
        },
        platforms: {
          bsonType: [
            'array'
          ],
          description: 'game genres',
          items: {
            properties: {
              name: {
                bsonType: 'string',
                description: 'platform name'
              },
              year: {
                bsonType: 'int',
                description: 'release year on platform'
              }
            },
            bsonType: 'object',
            required: [
              'name',
              'year'
            ],
            additionalProperties: false
          }
        },
        _id: {
          description: '_id is the unique objectId key',
          bsonType: 'objectId'
        },
        title: {
          bsonType: 'string',
          description: 'title of game'
        },
        description: {
          bsonType: 'string',
          description: 'description of game'
        }
      }
    }
  }
});
db.createCollection("ipblock", {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        '_id',
        'ip',
        'timestamp',
        'action'
      ],
      additionalProperties: false,
      properties: {
        count: {
          bsonType: 'int',
          description: 'client action count'
        },
        _id: {
          bsonType: 'objectId',
          description: '_id is the unique objectId key'
        },
        ip: {
          bsonType: 'string',
          description: 'client ip'
        },
        timestamp: {
          bsonType: 'date',
          description: 'last timestamp'
        },
        action: {
          bsonType: 'string',
          description: 'client action (login,register)'
        }
      }
    }
  }
});