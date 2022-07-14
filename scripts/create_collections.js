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
        'position',
        'user_id',
        'user_age',
        'user_gender',
        'user_groups',
        'game_id',
        'game_title',
        'game_year',
        'game_moby_id',
        'game_genres',
        'game_gameplay',
        'game_perspectives',
        'game_settings',
        'game_topics',
        'game_platforms'
      ],
      additionalProperties: false,
      properties: {
        _id: {
          bsonType: 'objectId',
          description: '_id is the unique objectId key'
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
        },
        user_id: {
          bsonType: 'objectId',
          description: 'objectId key of user'
        },
        user_age: {
          bsonType: 'int',
          description: 'user age',
          minimum: 0,
          maximum: 10
        },
        user_gender: {
          bsonType: 'string',
          description: 'user gender'
        },
        user_groups: {
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
        game_genres: {
          bsonType: 'array',
          description: 'game genres',
          items: {
            bsonType: 'string',
            description: 'unique genre string'
          }
        },
        game_gameplay: {
          bsonType: 'array',
          description: 'game gameplay',
          items: {
            bsonType: 'string',
            description: 'unique gameplay string'
          }
        },
        game_perspectives: {
          bsonType: 'array',
          description: 'game perspectives',
          items: {
            bsonType: 'string',
            description: 'unique perspective string'
          }
        },
        game_settings: {
          bsonType: 'array',
          description: 'game settings',
          items: {
            bsonType: 'string',
            description: 'unique setting string'
          }
        },
        game_topics: {
          bsonType: 'array',
          description: 'game topics',
          items: {
            bsonType: 'string',
            description: 'unique topic string'
          }
        },
        game_platforms: {
          bsonType: 'array',
          description: 'game platforms',
          items: {
            bsonType: 'string',
            description: 'unique platform string'
          }
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
        'platforms',
        'screenshots',
        'description',
        'year',
        'genres',
        'gameplay',
        'perspectives',
        'settings',
        'topics'
      ],
      additionalProperties: false,
      properties: {
        _id: {
          bsonType: 'objectId',
          description: '_id is the unique objectId key'
        },
        title: {
          bsonType: 'string',
          description: 'title of game'
        },
        description: {
          bsonType: 'string',
          description: 'description of game'
        },
        moby_id: {
          bsonType: 'int',
          description: 'mobygames.com game id'
        },
        moby_url: {
          bsonType: 'string',
          description: 'mobygames.com game url'
        },
        year: {
          bsonType: 'int',
          description: 'release year of game'
        },
        cover_url: {
          bsonType: 'string',
          description: 'url of cover image'
        },
        thumbnail_url: {
          bsonType: 'string',
          description: 'url of cover thumbnail'
        },
        icon: {
          bsonType: 'string',
          description: '32x32 game icon in webp format encoded in base64'
        },
        image: {
          bsonType: 'binData',
          description: 'Small example screenshot in webp format'
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
          description: 'game platforms',
          items: {
            bsonType: 'object',
            required: [
              'name',
              'year'
            ],
            additionalProperties: false,
            properties: {
              name: {
                bsonType: 'string',
                description: 'platform name'
              },
              year: {
                bsonType: 'int',
                description: 'release year on platform'
              }
            }
          }
        },
        genres: {
          bsonType: [
            'array'
          ],
          description: 'game genres',
          items: {
            bsonType: 'string',
            description: 'unique genre name'
          }
        },
        gameplay: {
          bsonType: [
            'array'
          ],
          description: 'game gameplay',
          items: {
            bsonType: 'string',
            description: 'unique gameplay name'
          }
        },
        perspectives: {
          bsonType: [
            'array'
          ],
          description: 'game perspectives',
          items: {
            bsonType: 'string',
            description: 'unique perspective name'
          }
        },
        settings: {
          bsonType: [
            'array'
          ],
          description: 'game settings',
          items: {
            bsonType: 'string',
            description: 'unique setting name'
          }
        },
        topics: {
          bsonType: [
            'array'
          ],
          description: 'game topics',
          items: {
            bsonType: 'string',
            description: 'unique topic name'
          }
        }
      }
    }
  }
});