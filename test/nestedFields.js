const { v4: uuid } = require('uuid');

let Validator = require ('../Validator');

describe('Nested field validation', () => {
	it('Nested field validation', done => {
		const validator = new Validator({
			'hello': 'world',
			'bleep': uuid(),
			'person': {
				name: 'Robin Jacobs',
				age: 25,
				location: {
					country: 'Ireland',
					city: 'Dublin',
					city_coordinates: []
				}
			},
			'x': {
				'x': {
					'x': {
						'x': {
							'y': {
								'x': {
									'x': {
										'x': {
											'x': {
												'x': {
													'x': {
														'x': {
															'x': {
																'x': {
																	'something': ['required', 'string'],
																	'id': 'uuid'
																}
															}
														}
													}
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}
		}, {
			'hello': ['string', 'minlength:3'],
			'bleep': 'uuid',
			'person': {
				'name': ['minlength:3', 'regex:^[^\\s].+\\s.+[^\\s]$'],
				'age': 'integer',
				'location': {
					'country': 'string',
					'city': ['required', 'minlength:2'],
					'city_coordinates': 'array'
				}
			},
			'x': {
				'x': {
					'x': {
						'x': {
							'y': {
								'x': {
									'x': {
										'x': {
											'x': {
												'x': {
													'x': {
														'x': {
															'x': {
																'x': {
																	'something': 'hello',
																	'id': uuid()
																}
															}
														}
													}
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}
		})
		if (validator.validate()) {
			done();
			return;
		}

		done(validator.errors);
	});

	it('Nested field validation provides correct error message', done => {
		const validator = new Validator({
			'x': {
				'x': {
					'x': {
						'x': {
							'y': {
								'x': {
									'x': {
										'x': {
											'x': {
												'x': {
													'x': {
														'x': {
															'x': {
																'x': {
																	'something': 'hello',
																	'id': 'not-a-valid-uuid'
																}
															}
														}
													}
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}
		}, {
			'x': {
				'x': {
					'x': {
						'x': {
							'y': {
								'x': {
									'x': {
										'x': {
											'x': {
												'x': {
													'x': {
														'x': {
															'x': {
																'x': {
																	'something': ['required', 'string'],
																	'id': 'uuid'
																}
															}
														}
													}
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}
		});

		if (validator.validate()) {
			done('Should not be valid');
			return;
		} else if (validator.valid !== false) {
			done('validate() returned false but valid !== false');
			return;
		} else if (validator.errors == ['x.x.x.x.y.x.x.x.x.x.x.x.x.x.id must be a valid UUID']) {
			done('Validation error should be: x.x.x.x.y.x.x.x.x.x.x.x.x.x.id must be a valid UUID');
			return;
		} else if (validator.fieldErrors[0].error !== 'Must be a valid UUID') {
			done('Field error should be: Must be a valid UUID');
			return;
		}

		done();
	});
});
