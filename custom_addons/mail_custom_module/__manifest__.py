{
    'name': 'Mail custom Module',
    'version': '1.0',
    'category': 'Tools',
    'summary': 'A custom module',
    'description': 'Description of the custom module',
    'author': 'Your Name',
    'depends': ['base', 'web'],  # Add any required dependencies here
    'data': [
        # List views, actions, and other files to be loaded by Odoo
    ],
    'assets':{
        'web.assets_backend':[
            'mail_custom_module/static/src/components/button_controller.xml'
        ],
    },
    'installable': True,
    'application': True,  # Set this to True if you want the module to show as an app
    'auto_install': False,
}
